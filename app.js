const mysql = require("mysql");
const express = require("express");
const bodyParser = require("body-parser");
const encoder = bodyParser.urlencoded();
const app = express();
const amqp = require("amqplib");
const data = require("./data/data.json")
const queueName = process.argv[2] || "jobsQueue";
const redis = require("redis");
const res = require("express/lib/response");
const { redirect } = require("express/lib/response");
var alert = require('alert');

app.use("/models", express.static("models"));

const message = { array: [] };      //Saving data to send consumer.js
var counter = 0, username, password, firstHour, firstMin, secondHour, secondMin, tmp = 0, lastDate, result, state = 0, first, second, selectedCarId, loginCounter = 0;


//MySQL Connection
const connection = mysql.createConnection({

    host: "127.0.0.1",
    port: "3306",
    user: "root",
    password: "Kenan.12",
    database: "nodejs"

});

//Connect to the database
connection.connect(function (error) {

    if (error) throw error;
    else console.log("connected to the database successfully");

});

//Url de "/" girilme durumunda yönlendirlecek sayfa
app.get("/", function (req, res) {
    res.sendFile(__dirname + "/views/index.html");
});

//Url de "/views/road.html" girilme durumunda yönlendirlecek sayfa
app.get("/views/road.html", function (req, res) {
    res.sendFile(__dirname + "/views/road.html");
});

//Authenticate the application with the database
app.post("/", encoder, function (req, res) {

    username = req.body.username;
    password = req.body.password;


    //Get the current date
    let date_ob = new Date(Date.now());
    let day = date_ob.getDate();
    let month = date_ob.getMonth() + 1;
    let year = date_ob.getFullYear();
    let saat = date_ob.getHours();
    let dak = date_ob.getMinutes();
    let dateResult = `${day}-${month}-${year} ${saat}:${dak}`;

    //console.log(dateResult);

    connection.query("select * from loginuser where user_name = ? and user_pass = ?", [username, password], function (error, results, field) {

        if (results.length > 0) {

            //Save the logged In time
            connection.query("update nodejs.loginuser set loggedIn_date = ?  where user_name = ?", [dateResult, username], function (error, result, field) {

                if (error) throw error;
                else console.log("The date added successfully to database (loggedIn_date)")
            });

            //Get the first car id from database
            connection.query("select firstCar from nodejs.loginuser where user_name = ?", [username], function (error, result, field) {

                if (error) throw error;
                else first = result[0].firstCar;
            });
            //Get the second car id from database
            connection.query("select secondCar from nodejs.loginuser where user_name = ?", [username], function (error, result, field) {

                if (error) throw error;
                else second = result[0].secondCar;
            });

            connect_rabbitmq("2018-10-02", "17", "29", secondHour, secondMin, 0);
            res.redirect("/views/homePage.html");
        }
        else {
            res.redirect("/");
            loginCounter = loginCounter + 1;
            if (loginCounter % 3 == 0) alert('User information has been entered incorrectly three times. Try again after 5 seconds.');
        }

        res.end();
    });
});

//When login is success
app.get("/views/homePage.html", function (req, res) {
    res.sendFile(__dirname + "/views/homePage.html");
});

//If any date selected
app.post("/views/homePage.html", encoder, function (req, res) {

    // JSON formatinda hazirla
    response = {

        firstDate: req.body.firstDate,
        secondDate: req.body.secondDate,
        carName: req.body.carName
    };

    //Get the first car id from database
    connection.query("select firstCar from nodejs.loginuser where user_name = ?", [username], function (error, result, field) {

        if (error) throw error;
        else first = result[0].firstCar;
    });

    //Get the second car id from database
    connection.query("select secondCar from nodejs.loginuser where user_name = ?", [username], function (error, result, field) {

        if (error) throw error;
        else second = result[0].secondCar;
    });

    if (response.carName == "car1") selectedCarId = first;
    if (response.carName == "car2") selectedCarId = second;
    //console.log(selectedCarId);

    if (response.firstDate && response.secondDate) {

        date = response.firstDate.substring(0, 10);

        firstHour = response.firstDate.substring(11, 13);
        firstMin = response.firstDate.substring(14);

        secondHour = response.secondDate.substring(11, 13);
        secondMin = response.secondDate.substring(14);

        //console.log(`First Date => ${date} ${firstHour}:${firstMin}`);
        //console.log(`Second Date => ${date} ${secondHour}:${secondMin}`);

        state = 1;
        connect_rabbitmq(date, firstHour, firstMin, secondHour, secondMin, state);
        //res.redirect("road.html");
    }

    res.sendFile(__dirname + "/views/road.html");
});

//Publisher
async function connect_rabbitmq(date, firstHour, firstMin, secondHour, secondMin, state) {
    //console.log(first);
    //console.log(second);

    try {

        //Connection to the RabbitMQ Server
        const connection = await amqp.connect("amqp://localhost:5672");
        const channel = await connection.createChannel();
        const assertion = await channel.assertQueue(queueName);


        if (state == 0) {      //If did not select any date range

            //--------------------------------The Algorithm of The Last 30 Minutes--------------------------------//        
            while (counter < 30) {

                if (firstMin > 00) firstMin = firstMin - 1;

                else {
                    firstHour = firstHour - 1;
                    firstMin = 59;
                }

                lastDate = `${date} ${firstHour}:${firstMin}`

                data.forEach(i => {

                    if (i.date == lastDate) {          //saving data which is equal to the selected id and date

                        if (i.id == first) message.array.push(i);
                        if (i.id == second) message.array.push(i);

                    }
                });

                counter = counter + 1;
            }
            //--------------------------------The Algorithm of The Last 30 Minutes--------------------------------//

        }

        if (state == 1) {      //If selected any date range


            //----------------------The Algorithm of Finding Data Between The Selected Dates----------------------//

            while (firstHour >= secondHour) {

                if (firstHour == secondHour) {                                          //if the dates's hours are equal

                    while (firstMin >= secondMin) {

                        lastDate = `${date} ${firstHour}:${firstMin}`

                        data.forEach(i => {

                            if (i.date == lastDate && i.id == selectedCarId) message.array.push(i);      //saving data which is equal to the selected id and date            
                        });

                        firstMin = firstMin - 1;
                    }

                } else {

                    for (tmp = firstMin; tmp >= 00; tmp--) {

                        lastDate = `${date} ${firstHour}:${tmp}`

                        data.forEach(i => {

                            if (i.date == lastDate && i.id == selectedCarId) {                            //saving data which is equal to the selected id and date

                                //console.log(lastDate);
                                message.array.push(i);
                            }
                        });

                    }

                    firstMin = 59;
                }

                firstHour = firstHour - 1;
            }
            //----------------------The Algorithm of Finding Data Between The Selected Dates----------------------//
        }

        channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)));    //sending to the queue
        //console.log("Gonderilen Mesaj", message);
        consumer();

    } catch (error) {
        console.log("Error", error);
    }

    //Clear RAM
    message.array = [];
    counter = 0;
    selectedDate = [];
    splittedDate = [];
    firstDate = [];
    firsSiplitted = []
    secondDate = [];
    secondSplitted = [];
}

//Consumer
function consumer() {

    //Red,s Settings
    const client = redis.createClient({
        host: '127.0.0.1',
        port: 8080,
        redis
    });

    connect_rabbitmq();

    async function connect_rabbitmq() {

        try {

            //RabbitMQ Connection Settings
            const connection = await amqp.connect("amqp://localhost:5672");
            const channel = await connection.createChannel();
            const assertion = await channel.assertQueue(queueName);

            //Getting message from publisher.js
            channel.consume(queueName, message => {

                const messageInfo = JSON.parse(message.content.toString())                                //convert to json

                //console.log("İşlenen Kayıt", messageInfo);

                client.set(`user_${messageInfo.id}`, JSON.stringify(messageInfo), (error, status) => {    //setting datas to redis

                    if (!error) channel.ack(message);
                });

                client.get(`user_${messageInfo.id}`, (error, status) => {

                    if (error) console.error(error);

                    result = JSON.parse(status).array;

                    console.log("Status => ", result);
                    getId(first, second);
                    if (state == 0) getData(result);
                    if (state == 1) getData2(result);

                });
            });

        } catch (error) {
            console.log("Error", error);
        }
    }

}

//Send car id to html file
function getId(first, second) {
    //console.log(first);
    //console.log(second);
    var data = {
        id1: first,
        id2: second,
    }
    app.get('/id', function (req, res) {

        //console.log(array);

        res.jsonp(data);
    });
}

//Send data to html file
function getData(temp) {

    app.get('/data', function (req, res) {

        //console.log(temp);

        message.array = [];
        counter = 0;
        tmp = 0;
        state = 0;
        message.array = [];

        res.jsonp(temp);
    });
}

//Send data to html file(if any date selected)
function getData2(temp2) {

    app.get('/data2', function (req, res) {

        //console.log(temp2);

        message.array = [];
        counter = 0;
        tmp = 0;
        state = 0;

        res.jsonp(temp2);
    });
}

//Logout
app.post("/logout", encoder, function (req, res) {

    //Get the current date
    let date_ob = new Date(Date.now());
    let day = date_ob.getDate();
    let month = date_ob.getMonth() + 1;
    let year = date_ob.getFullYear();
    let saat = date_ob.getHours();
    let dak = date_ob.getMinutes();
    let dateResult = `${day}-${month}-${year} ${saat}:${dak}`;

    //Save the logged In time
    connection.query("update nodejs.loginuser set loggedOut_date = ?  where user_name = ?", [dateResult, username], function (error, result, field) {

        if (error) throw error;
        else console.log("The date added successfully to database (loggedOut_date)")
    });

    res.redirect("/");
});

//Set app port
app.listen(4000);
