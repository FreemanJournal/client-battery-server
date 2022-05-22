const express = require("express");
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require('dotenv').config();

const app = express()
const port = process.env.PORT || 5000

// middleware
app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ajeexbn.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });



async function run() {
  try {
    await client.connect();
    const productCollection = client.db("speed_battery_manufacturer").collection("products");
    const ordersCollection = client.db("speed_battery_manufacturer").collection("orders");


    /************************************ Product api *********************************************/
    app.get('/product/:productID', async (req, res) => {
      const productID = req.params.productID
      const result = await productCollection.findOne({ _id: ObjectId(productID) })
      res.send(result)
    })
    app.get('/product', async (req, res) => {
      const result = await productCollection.find({}).toArray()
      res.send(result)
    })
    app.post('/product', async (req, res) => {
      const product = req.body
      await productCollection.insertOne(product)
      res.send({ success: true, message: `${product.name} is ready to sell!` })
    })


    /************************************ Product api *********************************************/
    app.post('/order', async (req, res) => {
      const product = req.body
      await ordersCollection.insertOne(product)
      res.send({ success: true})
    })


  } finally {
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send("Hello Mom")
})

app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})