require("dotenv").config();
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

// firebase admin
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf-8"
);
const serviceAccount = JSON.parse(decoded);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// middleware
app.use(
  cors({
    origin: ["http://localhost:5173", process.env.CLIENT_URL],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.use(express.json());

// jwt middlewares
const verifyJWT = async (req, res, next) => {
  const token = req?.headers?.authorization?.split(" ")[1];
  console.log(token);
  if (!token) return res.status(401).send({ message: "Unauthorized Access!" });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.tokenEmail = decoded.email;
    console.log(decoded);
    next();
  } catch (err) {
    console.log(err);
    return res.status(401).send({ message: "Unauthorized Access!", err });
  }
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.alsn6h3.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const myDB = client.db("ticketBariDB");
    const allTicketsCollection = myDB.collection("allTickets");
    const allBookingTicketsCollection = myDB.collection("bookedTickets");

    // all ticket api
    app.post("/tickets", async (req, res) => {
      const ticketData = req.body;
      ticketData.status = "pending";
      const result = await allTicketsCollection.insertOne(ticketData);
      res.send(result);
    });

    app.get("/tickets", async (req, res) => {
      const result = await allTicketsCollection.find().toArray();
      res.send(result);
    });

    app.get("/tickets/approved", async (req, res) => {
      // alltickets a eita dekhano hoyeche
      const result = await allTicketsCollection
        .find({ status: "approved" })
        .toArray();
      res.send(result);
    });

    app.get("/tickets/approved/:id", async (req, res) => {
      // alltickets details a dekhano hoyeche
      const id = req.params.id;
      const result = await allTicketsCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    app.patch("/tickets/status/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const query = { _id: new ObjectId(id) };
      const updatedStatus = {
        $set: {
          status,
        },
      };
      const result = await allTicketsCollection.updateOne(query, updatedStatus);
      res.send(result);
    });

    app.delete("/tickets/:id", async (req, res) => {
      const id = req.params.id;
      const result = await allTicketsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // /booking-tickets related api
    app.post("/booking-tickets", async (req, res) => {
      const bookingTicketData = req.body;
      bookingTicketData.status = "pending";
      const result = await allBookingTicketsCollection.insertOne(
        bookingTicketData
      );
      res.send(result);
    });

    app.get("/booking-tickets", async (req, res) => {
      const result = await allBookingTicketsCollection.find().toArray();
      res.send(result);
    });

    app.patch("/booking-tickets/accept/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedStatus = {
        $set: {
          status: "Accept",
        },
      };
      const result = await allBookingTicketsCollection.updateOne(
        query,
        updatedStatus
      );
      res.send(result);
    });

    app.patch("/booking-tickets/reject/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedStatus = {
        $set: {
          status: "Reject",
        },
      };
      const result = await allBookingTicketsCollection.updateOne(
        query,
        updatedStatus
      );
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("TicketBari is running..........");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
