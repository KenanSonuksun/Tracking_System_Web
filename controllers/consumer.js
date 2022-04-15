const amqp = require("amqplib");
const queueName = process.argv[2] || "jobsQueue";
const data = require("../data.json");
const redis = require("redis");
const res = require("express/lib/response");

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

              //console.log("Status => ", result);

              if (state == 0) getData(result);
              if (state == 1) getData2(result);

          });
      });

  } catch (error) {
      console.log("Error", error);
  }
}