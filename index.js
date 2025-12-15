require("dotenv").config();
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;
const stripe = require("stripe")(process.env.STRIPE_SERECT_KEY);

// FIREBASE ADMIN

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf-8"
);
const serviceAccount = JSON.parse(decoded);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// MIDDLEWARE

app.use(
  cors({
    origin: ["http://localhost:5173", process.env.CLIENT_URL],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.use(express.json());

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
    // const advertiseCollection = myDB.collection("advertiseTicket");

    // ROLE MIDDLEWARE

    const verifyJWT = async (req, res, next) => {
      const token = req?.headers?.authorization?.split(" ")[1];
      if (!token)
        return res.status(401).send({ message: "Unauthorized Access!" });
      try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.tokenEmail = decoded.email;

        next();
      } catch (err) {
        console.log(err);
        return res.status(401).send({ message: "Unauthorized Access!", err });
      }
    };

    const verifyADMIN = async (req, res, next) => {
      const email = req.tokenEmail;
      const user = await userCollection.findOne({ email });
      if (user?.role !== "admin")
        return res
          .status(403)
          .send({ message: "Admin only Actions!", role: user?.role });

      next();
    };

    const verifySELLER = async (req, res, next) => {
      const email = req.tokenEmail;
      const user = await userCollection.findOne({ email });
      if (user?.role !== "seller")
        return res
          .status(403)
          .send({ message: "Seller only Actions!", role: user?.role });

      next();
    };

    // ALL TICKET API

    app.post("/tickets", async (req, res) => {
      const ticketData = req.body;
      ticketData.status = "pending";
      ticketData.createdAt = new Date().toISOString();
      ticketData.verificationStatus = "pending";
      ticketData.isAdvertise = false;
      const result = await allTicketsCollection.insertOne(ticketData);
      res.send(result);
    });

    app.get("/tickets", async (req, res) => {
      const result = await allTicketsCollection.find().toArray();
      res.send(result);
    });

    app.delete("/tickets/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allTicketsCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/tickets/vendor", async (req, res) => {
      const vendorEmail = req.query.email;
      const result = await allTicketsCollection.find({ vendorEmail }).toArray();
      res.send(result);
    });

    app.get("/tickets/approved", async (req, res) => {
      // alltickets a eita dekhano hoyeche
      const result = await allTicketsCollection
        .find({ status: "approved" })
        .toArray();
      res.send(result);
    });

    // ADVERTISE / UNADVERTISE TICKET (Admin only)
    app.patch(
      "/tickets/advertise/:id",
      verifyJWT,
      verifyADMIN,
      async (req, res) => {
        const { id } = req.params;
        const { isAdvertise } = req.body;

        if (typeof isAdvertise !== "boolean") {
          return res.status(400).send({ message: "Invalid advertise value" });
        }

        try {
          // If trying to ADVERTISE → enforce max 6 rule
          if (isAdvertise === true) {
            const advertisedTickets = await allTicketsCollection
              .find({ isAdvertise: true })
              .limit(6)
              .toArray();

            if (advertisedTickets.length >= 6) {
              return res.status(403).send({
                message: "Maximum 6 tickets can be advertised",
              });
            }
          }

          const result = await allTicketsCollection.updateOne(
            { _id: new ObjectId(id) },
            {
              $set: {
                isAdvertise,
              },
            }
          );

          if (result.matchedCount === 0) {
            return res.status(404).send({ message: "Ticket not found" });
          }

          res.send({
            modifiedCount: result.modifiedCount,
            message: "Advertise status updated successfully",
          });
        } catch {
          res.status(500).send({ message: "Server error" });
        }
      }
    );

    app.get("/tickets/approved/:id", async (req, res) => {
      // alltickets details a dekhano hoyeche
      const id = req.params.id;
      const result = await allTicketsCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // app.post("/advertiseTickets", async (req, res) => {
    //   const advertiseTicketData = req.body;
    //   advertiseTicketData.isAdvertise = true;
    //   delete advertiseTicketData._id;
    //   const result = await advertiseCollection.insertOne(advertiseTicketData);
    //   res.send(result);
    // });

    app.patch("/tickets/status/approved/:id", async (req, res) => {
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

    app.patch("/tickets/status/rejected/:id", async (req, res) => {
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

    //  BOOKING-TICKETS RELATED API

    app.post("/booking-tickets", async (req, res) => {
      const bookingTicketData = req.body;
      console.log(bookingTicketData);
      bookingTicketData.status = "pending";
      bookingTicketData.paymentStatus = "not-paid";
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

    // PAYMENT RELATED API

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
        // console.log(paymentInfo)

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

        if (session.payment_status !== "paid") {
          return res.status(400).json({ message: "Payment not completed" });
        }

        const existingPayment = await ticketsPaymentCollection.findOne({
          sessionId,
        });
        if (existingPayment) {
          return res.send(existingPayment);
        }

        const transactionId = session.payment_intent; // ✅ MAIN FIX
        // console.log({transactionId});

        const lineItems = await stripe.checkout.sessions.listLineItems(
          sessionId
        );

        const paymentDoc = {
          ticketId: session.metadata?.ticketId || null,
          name: session.customer_details?.name || null,
          email: session.customer_details?.email || null,

          amount: session.amount_total / 100,
          currency: session.currency,
          status: session.payment_status,

          productTitle: lineItems.data[0]?.description || null,
          quantity: lineItems.data[0]?.quantity || 1,

          sessionId,
          transactionId,

          createdAt: new Date(),
        };

        const result = await ticketsPaymentCollection.insertOne(paymentDoc);

        res.send({
          success: true,
          transactionId,
          result,
        });
      } catch (error) {
        console.error("Payment Save Error:", error);
        res.status(500).json({ message: "Server error" });
      }
    });

    app.get("/dashboard/payment/success", async (req, res) => {
      const result = await ticketsPaymentCollection.find().toArray();
      res.send(result);
    });

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

    // get a user's role
    app.get("/user/role", verifyJWT, async (req, res) => {
      const result = await userCollection.findOne({ email: req.tokenEmail });
      res.send({ role: result?.role });
    });

    // get all users for admin - manage user
    app.get("/users", verifyJWT, verifyADMIN, async (req, res) => {
      const adminEmail = req.tokenEmail;
      const result = await userCollection
        .find({ email: { $ne: adminEmail } })
        .toArray();
      res.send(result);
    });

    // Make a user ADMIN (Admin only)
    app.patch(
      "/users/make-admin/:id",
      verifyJWT,
      verifyADMIN,
      async (req, res) => {
        const { id } = req.params;

        const user = await userCollection.findOne({ _id: new ObjectId(id) });
        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        if (user.role === "admin") {
          return res.status(400).send({ message: "User is already admin" });
        }

        const result = await userCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              role: "admin",
              updatedAt: new Date(),
            },
          }
        );

        res.send({ message: "User promoted to admin", result });
      }
    );
    // Make a user VENDOR (Admin only)
    app.patch(
      "/users/make-vendor/:id",
      verifyJWT,
      verifyADMIN,
      async (req, res) => {
        const { id } = req.params;

        const user = await userCollection.findOne({ _id: new ObjectId(id) });
        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        if (user.role === "vendor") {
          return res.status(400).send({ message: "User is already a vendor" });
        }

        if (user.role === "admin") {
          return res
            .status(400)
            .send({ message: "Admin role cannot be downgraded" });
        }

        const result = await userCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              role: "vendor",
              updatedAt: new Date(),
            },
          }
        );

        res.send({ message: "User promoted to vendor", result });
      }
    );

    // Mark a vendor as FRAUD (Admin only)
    app.patch(
      "/users/mark-fraud/:id",
      verifyJWT,
      verifyADMIN,
      async (req, res) => {
        const { id } = req.params;

        const user = await userCollection.findOne({ _id: new ObjectId(id) });
        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        if (user.role !== "vendor") {
          return res
            .status(400)
            .send({ message: "Only vendors can be marked as fraud" });
        }

        await userCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              role: "fraud",
              fraudAt: new Date(),
            },
          }
        );

        await allTicketsCollection.updateMany(
          { vendorEmail: user.email },
          {
            $set: {
              isHidden: true,
              hiddenAt: new Date(),
            },
          }
        );

        res.send({
          message:
            "Vendor marked as fraud. All tickets hidden and future actions blocked.",
        });
      }
    );

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
