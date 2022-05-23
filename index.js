const express = require("express");
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
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
    const paymentCollection = client.db("speed_battery_manufacturer").collection("payments");


    /************************************ Shipping api *********************************************/
    app.patch('/shipping/:productID', async (req, res) => {
      const productID = req.params.productID
      const updateDoc = {
        $set: {
          isShipped:true
        }
      }
      await ordersCollection.updateOne({ _id: ObjectId(productID) }, updateDoc);
      res.send({ success: true, message: `Product shipped successfully` })

    })
    /************************************ Payment api *********************************************/
    app.patch('/payment/:productID', async (req, res) => {
      const productID = req.params.productID
      const payment = req.body
      const updateDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId
        }
      }
      await paymentCollection.insertOne(payment);
      await ordersCollection.updateOne({ _id: ObjectId(productID) }, updateDoc);
      res.send({ success: true, message: `You Successfully paid for ${payment.product}` })

    })
    /************************************ Stripe api *********************************************/
    app.post('/create-payment-intent', async (req, res) => {
      const total = req.body.total
      const amount = total * 100
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card']
      })
      res.send({ clientSecret: paymentIntent.client_secret })
    })
    /************************************ Order api *********************************************/
    app.delete('/order/:productID', async (req, res) => {
      const productID = req.params.productID
      await ordersCollection.deleteOne({ _id: ObjectId(productID) })
      res.send({success:true,message:"Your order deleted successfully."})
    })
    app.get('/order/:productID', async (req, res) => {
      const productID = req.params.productID
      const result = await ordersCollection.findOne({ _id: ObjectId(productID) })
      res.send(result)
    })
    app.get('/order', async (req, res) => {
      const result = await ordersCollection.find({}).sort({$natural:-1}).toArray()
      res.send(result)
    })
    app.post('/order', async (req, res) => {
      const product = req.body
      await ordersCollection.insertOne(product)
      res.send({ success: true })
    })

    /************************************ Product api *********************************************/
    app.delete('/product/:productID', async (req, res) => {
      const { productID } = req.params
      await productCollection.deleteOne({ _id: ObjectId(productID) });
      res.send({ success: true, message: `Product Successfully Deleted` })
    })
    app.put('/product', async (req, res) => {
      const product = req.body
      const result = await productCollection.updateOne({ _id: ObjectId(product.id) }, { $set: product });
      res.send({ success: true, message: `${product.name} is updated` })
    })
    app.get('/product/:productID', async (req, res) => {
      const productID = req.params.productID
      const result = await productCollection.findOne({ _id: ObjectId(productID) })
      res.send(result)
    })

    app.get('/product', async (req, res) => {
      const result = await productCollection.find({}).sort({ $natural: -1 }).limit(3).toArray()
      res.send(result)
    })
    app.get('/product_all', async (req, res) => {
      const result = await productCollection.find({}).sort({ $natural: -1 }).toArray()
      res.send(result)
    })
    app.post('/product', async (req, res) => {
      const product = req.body
      await productCollection.insertOne(product)
      res.send({ success: true, message: `${product.name} is ready to sell!` })
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