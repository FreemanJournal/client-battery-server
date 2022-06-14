const express = require("express");
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require('dotenv').config();
var jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const nodemailer = require('nodemailer');
const mg = require('nodemailer-mailgun-transport');
const app = express()
const port = process.env.PORT || 5000

// middleware
app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ajeexbn.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJwt(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: "Unauthorized access." })
  }
  const authToken = authorization.split(' ')[1]
  jwt.verify(authToken, process.env.JWT_ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden Access" });
    }
    req.decoded = decoded;
    next();
  })
  // next();
}



async function run() {
  try {
    await client.connect();
    const productCollection = client.db("speed_battery_manufacturer").collection("products");
    const ordersCollection = client.db("speed_battery_manufacturer").collection("orders");
    const paymentCollection = client.db("speed_battery_manufacturer").collection("payments");
    const userCollection = client.db("speed_battery_manufacturer").collection("users");
    const reviewCollection = client.db("speed_battery_manufacturer").collection("reviews");
    const blogCollection = client.db("speed_battery_manufacturer").collection("blogs");

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await userCollection.findOne({ email })
      // // console.log('isAdmin',!user.isAdmin);
      if (!user.isAdmin) {
        return res.status(403).send({ message: "Forbidden Access." })
      }
      next();
    }


    /************************************ Blog api *********************************************/
    app.get('/blog', async (req, res) => {
      const result = await blogCollection.find({}).toArray()
      res.send(result)
    })

    /************************************ Create Review api *********************************************/
    app.get('/review', async (req, res) => {
      const result = await reviewCollection.find({}).sort({ $natural: -1 }).toArray()
      res.send(result)
    })
    app.post('/review', verifyJwt, async (req, res) => {
      const review = req.body
      await reviewCollection.insertOne(review)
      res.send({ success: true })
    })
    /************************************ User api *********************************************/

    app.delete("/user/:email", verifyJwt, verifyAdmin, async (req, res) => {
      const { email } = req.params
      const result = await userCollection.deleteOne({ email });
      if (result.deletedCount > 0) {
        res.send({ success: true })
      }

    })
    app.get("/user", verifyJwt, verifyAdmin, async (req, res) => {
      const result = await userCollection.find({}).sort({ $natural: -1 }).toArray();
      res.send(result)

    })
    app.get("/user/:email", async (req, res) => {
      const { email } = req.params
      const result = await userCollection.findOne({ email })
      // console.log(object);
      res.send(result)

    })
    app.get("/isAdmin/:email", async (req, res) => {
      const { email } = req.params
      const user = await userCollection.findOne({ email })
      if (!!user?.isAdmin) {
        return res.send({ success: true })
      } else {
        return res.send({ success: false })
      }

    })
    app.put("/user/admin", verifyJwt, verifyAdmin, async (req, res) => {
      const { email, status } = req.body
      const result = await userCollection.updateOne({ email }, { $set: { isAdmin: status } }, { upsert: true });
      if (result.modifiedCount > 0) {
        res.send({ success: true })
      }
    })
    app.put("/user/update", verifyJwt, async (req, res) => {
      const user = req.body
      user && delete user._id
      const result = await userCollection.updateOne({ email: user.email }, { $set: user }, { upsert: true });
      if (result.modifiedCount > 0) {
        res.send({ success: true })
      }
    })
    app.post("/user", async (req, res) => {
      const user = req.body
      user && delete user?._id
      const result = await userCollection.updateOne({ email: user.email }, { $set: user }, { upsert: true });
      if (result.modifiedCount > 0) {
        res.send({ success: true })
      }
    })
    /************************************ Create Token api *********************************************/
    app.post("/createToken", async (req, res) => {
      const { email } = req.body
      const authAccessToken = jwt.sign({ email }, process.env.JWT_ACCESS_TOKEN, { expiresIn: "1d" })
      res.send({ authAccessToken })
    })
    /************************************ Shipping api *********************************************/
    app.patch('/shipping/:productID', verifyJwt, verifyAdmin, async (req, res) => {
      const productID = req.params.productID
      const updateDoc = {
        $set: {
          isShipped: true
        }
      }
      await ordersCollection.updateOne({ _id: ObjectId(productID) }, updateDoc);
      res.send({ success: true, message: `Product shipped successfully` })

    })
    /************************************ Payment api *********************************************/
    app.patch('/payment/:productID', verifyJwt, async (req, res) => {
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
    app.post('/create-payment-intent', verifyJwt, async (req, res) => {
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
    app.delete('/order/:productID', verifyJwt, async (req, res) => {
      const productID = req.params.productID
      await ordersCollection.deleteOne({ _id: ObjectId(productID) })
      res.send({ success: true, message: "Your order deleted successfully." })
    })
    app.get('/order/:productID', verifyJwt, async (req, res) => {
      const productID = req.params.productID
      const result = await ordersCollection.findOne({ _id: ObjectId(productID) })
      res.send(result)
    })

    app.get('/myOrder/:email', verifyJwt, async (req, res) => {
      const { email } = req.params
      const result = await ordersCollection.find({ email }).sort({ $natural: -1 }).toArray()
      res.send(result)
    })
    app.get('/order', verifyJwt, verifyAdmin, async (req, res) => {
      const result = await ordersCollection.find({}).sort({ $natural: -1 }).toArray()
      res.send(result)
    })

    app.post('/order', verifyJwt, async (req, res) => {
      const product = req.body
      await ordersCollection.insertOne(product)
      res.send({ success: true })
    })

    /************************************ Product api *********************************************/
    app.delete('/product/:productID', verifyJwt, verifyAdmin, async (req, res) => {
      const { productID } = req.params
      await productCollection.deleteOne({ _id: ObjectId(productID) });
      res.send({ success: true, message: `Product Successfully Deleted` })
    })
    app.put('/product', verifyJwt, verifyAdmin, async (req, res) => {
      const product = req.body
      const result = await productCollection.updateOne({ _id: ObjectId(product.id) }, { $set: product });
      res.send({ success: true, message: `${product.name} is updated` })
    })
    app.get('/product', async (req, res) => {
      const result = await productCollection.find({}).sort({ $natural: -1 }).limit(3).toArray()
      res.send(result)
    })
    app.get('/product/:productID', verifyJwt, async (req, res) => {
      const productID = req.params.productID
      const result = await productCollection.findOne({ _id: ObjectId(productID) })
      res.send(result)
    })


    app.get('/product_all', verifyJwt, verifyAdmin, async (req, res) => {
      const result = await productCollection.find({}).project({ image: 0, description: 0 }).sort({ $natural: -1 }).toArray()
      res.send(result)
    })
    app.post('/product', verifyJwt, verifyAdmin, async (req, res) => {
      const product = req.body
      await productCollection.insertOne(product)
      res.send({ success: true, message: `${product.name} is ready to sell!` })
    })


  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

/************************************ MailGun api *********************************************/
const auth = {
  auth: {
    api_key:process.env.MAILGUN_API_KEY,
    domain:process.env.MAILGUN_DOMAIN
  }
}

const nodemailerMailGun = nodemailer.createTransport(mg(auth));
const email = {
  from: 'myemail@example.com',
  to: 'blowberry97@gmail.com',
  subject: 'Hey you, awesome!',
  html: '<b>Wow Big powerful letters</b>',
  text: 'Bro Yoo'
}
// app.get('/email', async (req, res) => {
  
//   nodemailerMailGun.sendMail(email, (err, info) => {
//     if (err) {
//       console.log(err);
//     }
//     else {
//       console.log(info);
//       res.send('Mail has sent')
//     }
//   });

// })


app.get('/', (req, res) => {
  res.send("Hello Mom")
})

app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})