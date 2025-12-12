require("dotenv").config();
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;
const stripe = require("stripe")(process.env.STRIPE_SERECT_KEY);

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
    const ticketsPaymentCollection = myDB.collection("ticketPayment");
    const userCollection = myDB.collection("users");

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
          status: "accepted",
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
          status: "rejected",
        },
      };
      const result = await allBookingTicketsCollection.updateOne(
        query,
        updatedStatus
      );
      res.send(result);
    });

    // payment related api
    app.post("/create-checkout-session", async (req, res) => {
      try {
        const paymentInfo = req.body;

        const {
          id,
          paymentTitle,
          paymentPrice,
          paymentQuantity,
          userName,
          userEmail,
        } = paymentInfo;

        const session = await stripe.checkout.sessions.create({
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: paymentTitle,
                  description: `Ticket purchase by ${userName}`,
                },
                unit_amount: paymentPrice * 100,
              },
              quantity: paymentQuantity,
            },
          ],

          customer_email: userEmail,

          mode: "payment",

          metadata: {
            ticketId: id,
            buyerName: userName,
            buyerEmail: userEmail,
          },

          success_url: `${process.env.CLIENT_URL}/dashboard/success-payment?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.CLIENT_URL}/dashboard/cancel-payment`,
        });

        // -------------------------------------
        return res.send({ url: session.url });
      } catch (error) {
        console.error("Stripe Error:", error);
        return res.status(500).json({ message: "Something went wrong" });
      }
    });

    app.post("/dashboard/payment/success", async (req, res) => {
      try {
        const { sessionId } = req.body;

        if (!sessionId) {
          return res.status(400).json({ message: "Session ID missing" });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        const lineItems = await stripe.checkout.sessions.listLineItems(
          sessionId
        );

        const ticketId = session.metadata.ticketId;
        const buyerName = session.metadata.buyerName;
        const buyerEmail = session.metadata.buyerEmail;

        const amountTotal = session.amount_total / 100;
        const currency = session.currency;
        const status = session.payment_status;

        const productTitle = lineItems.data[0].description;
        const quantity = lineItems.data[0].quantity;

        if (session.status === "complete") {
          const paymentDoc = {
            ticketId,
            buyerName,
            buyerEmail,
            amount: amountTotal,
            currency,
            status,
            quantity,
            productTitle,
            sessionId,
            createdAt: new Date(),
          };
          const result = await ticketsPaymentCollection.insertOne(paymentDoc);
          return res.send(result);
        }
      } catch (error) {
        console.error("Payment Save Error:", error);
        return res.status(500).json({ message: "Server error" });
      }
    });

    //user related api
    app.post("/user", async (req, res) => {
      const userData = req.body;
      userData.created_at = new Date().toISOString();
      userData.last_loggedIn = new Date().toISOString();
      userData.role = "customer";
      const query = {
        email: userData.email,
      };
      const alreadyExists = await userCollection.findOne(query);
      if (alreadyExists) {
        console.log("Updating user info......");
        const result = await userCollection.updateOne(query, {
          $set: {
            last_loggedIn: new Date().toISOString(),
          },
        });
        return res.send(result);
      }
      const result = userCollection.insertOne(userData);
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
