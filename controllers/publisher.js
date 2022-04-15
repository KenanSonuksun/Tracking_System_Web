const amqp = require("amqplib");
const data = require("./data.json")
const queueName = process.argv[2] || "jobsQueue";

const message = {array: []};      //Saving data to send consumer.js   
var selectedDate, splittedDate, currentDate, hour, min, counter = 0, state = 1,  //the variable x determines queries
firstHour, firstMin, secondHour, secondMin, tmp = 0, lastDate, firstDate, firsSiplitted, secondDate, secondSplitted;

connect_rabbitmq();

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

          /*firstDate = "2018-10-02 13:01".split(' ');
          firsSiplitted = firstDate[1].split(':');
    
          secondDate = "2018-10-02 09:39".split(' ');
          secondSplitted = secondDate[1].split(':');
    
          firstHour = firsSiplitted[0];
          firstMin = firsSiplitted[1];
    
          secondHour = secondSplitted[0];
          secondMin = secondSplitted[1];
    
          currentDate = firstDate[0];*/

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
      console.log("Gonderilen Mesaj", message);
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
