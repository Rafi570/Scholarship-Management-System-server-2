const express = require("express");
const cors = require("cors");
require("dotenv").config();
const crypto = require("crypto");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const admin = require("firebase-admin");
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf8"
);
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    console.log("decoded in the token", decoded);
    req.decoded_email = decoded.email;
    next();
  } catch (err) {
    return res.status(401).send({ message: "unauthorized access" });
  }
};

function generateTrackingId(prefix = "APP") {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${date}-${random}`;
}

// const uri = process.env.URI;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lq5729d.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Connect to MongoDB
async function run() {
  try {
    // await client.connect();
    // console.log("Connected to MongoDB!");

    const db = client.db("Scholarship-Management-System");
    const userCollection = db.collection("user");
    const universityCollection = db.collection("university");
    const reviewCollection = db.collection("review");
    const applicationsCollection = db.collection("applications");
    const trackingsCollection = db.collection("trackings");

    // admin role check
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded_email;
      const query = { email };
      const user = await userCollection.findOne(query);

      if (!user || user.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }

      next();
    };
    const verifyModerator = async (req, res, next) => {
      const email = req.decoded_email;
      const query = { email };
      const user = await userCollection.findOne(query);
      console.log("moda");

      if (!user || user.role !== "moderator") {
        return res.status(403).send({ message: "forbidden access" });
      }

      next();
    };
    // logtracking
    const logTracking = async (trackingId, status) => {
      const log = {
        trackingId,
        status,
        details: status.split("_").join(" "),
        createdAt: new Date(),
      };
      const result = await trackingsCollection.insertOne(log);
      return result;
    };

    // user related Api
    app.post("/users", async (req, res) => {
      const user = req.body;
      user.role = "student";
      user.createdAt = new Date();
      const email = user.email;
      const userExists = await userCollection.findOne({ email });

      if (userExists) {
        return res.send({ message: "user exists" });
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    // app.get("/users",verifyToken, async (req, res) => {
    //   try {
    //     const { email } = req.query;
    //     let query = {};

    //     if (email) {
    //       query.email = email;
    //     }

    //     const users = await userCollection
    //       .find(query)
    //       .sort({ createdAt: -1 })
    //       .toArray();

    //     res.send(users);
    //   } catch (error) {
    //     console.error(error);
    //     res.status(500).send({ message: "Server error" });
    //   }
    // });

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const { email, searchText, role } = req.query;
        let query = {};

        // filter by email
        if (email) {
          query.email = email;
        }

        // filter by role
        if (role) {
          query.role = role;
        }

        // search by displayName OR email
        if (searchText) {
          query.$or = [
            { name: { $regex: searchText, $options: "i" } },
            { email: { $regex: searchText, $options: "i" } },
          ];
        }

        const users = await userCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();

        res.send(users);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server error" });
      }
    });

    app.patch("/users/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { role } = req.body;

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            role: role,
          },
        };

        const result = await userCollection.updateOne(filter, updateDoc);

        res.send({
          success: true,
          message: "User role updated successfully",
          result,
        });
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    app.get("/users/:email/role", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await userCollection.findOne(query);
      res.send({ role: user?.role || "student" });
    });

    app.delete("/users/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const filter = { _id: new ObjectId(id) };
        const result = await userCollection.deleteOne(filter);

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // university related Api

    app.get("/scholarships/cheapest", async (req, res) => {
      const result = await universityCollection
        .find({})
        .sort({ scholarshipPostDate: 1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // server.js or routes file
    // app.get("/scholarshipUniversity", async (req, res) => {
    //   try {
    //     let query = {};
    //     const {
    //       email,
    //       universityName,
    //       universityCountry,
    //       universityWorldRank,
    //       subjectCategory,
    //       scholarshipCategory,
    //       degree,
    //       search,
    //       sortBy, // New query parameter
    //     } = req.query;

    //     // Filters
    //     if (email) query.postedUserEmail = email;
    //     if (universityName) query.universityName = universityName;
    //     if (universityCountry) query.universityCountry = universityCountry;
    //     if (subjectCategory) query.subjectCategory = subjectCategory;
    //     if (scholarshipCategory)
    //       query.scholarshipCategory = scholarshipCategory;
    //     if (degree) query.degree = degree;

    //     if (universityWorldRank) {
    //       query.universityWorldRank = { $lte: Number(universityWorldRank) };
    //     }

    //     if (search) {
    //       query.$or = [
    //         { scholarshipName: { $regex: search, $options: "i" } },
    //         { universityName: { $regex: search, $options: "i" } },
    //       ];
    //     }

    //     // Sorting logic
    //     let sortObj = { scholarshipPostDate: -1 }; // default: newest first
    //     switch (sortBy) {
    //       case "nameAsc":
    //         sortObj = { scholarshipName: 1 };
    //         break;
    //       case "nameDesc":
    //         sortObj = { scholarshipName: -1 };
    //         break;
    //       case "rankAsc":
    //         sortObj = { universityWorldRank: 1 };
    //         break;
    //       case "rankDesc":
    //         sortObj = { universityWorldRank: -1 };
    //         break;
    //       case "postDateAsc":
    //         sortObj = { scholarshipPostDate: 1 };
    //         break;
    //       case "postDateDesc":
    //         sortObj = { scholarshipPostDate: -1 };
    //         break;
    //       default:
    //         break; // keep default
    //     }

    //     const result = await universityCollection
    //       .find(query)
    //       .sort(sortObj)
    //       .toArray();

    //     res.send(result);
    //   } catch (error) {
    //     console.error("Error fetching scholarships:", error);
    //     res.status(500).send({ error: "Internal Server Error" });
    //   }
    // });
    app.get("/scholarshipUniversity", async (req, res) => {
      try {
        let query = {};
        const {
          email,
          universityName,
          universityCountry,
          universityWorldRank,
          subjectCategory,
          scholarshipCategory,
          degree,
          search,
          sortBy,
          page = 1, // Default page = 1
          limit = 9, // Default 9 items per page
        } = req.query;

        if (email) query.postedUserEmail = email;
        if (universityName) query.universityName = universityName;
        if (universityCountry) query.universityCountry = universityCountry;
        if (subjectCategory) query.subjectCategory = subjectCategory;
        if (scholarshipCategory)
          query.scholarshipCategory = scholarshipCategory;
        if (degree) query.degree = degree;

        if (universityWorldRank) {
          query.universityWorldRank = { $lte: Number(universityWorldRank) };
        }

        if (search) {
          query.$or = [
            { scholarshipName: { $regex: search, $options: "i" } },
            { universityName: { $regex: search, $options: "i" } },
          ];
        }

        // Sorting
        let sortObj = { scholarshipPostDate: -1 };
        switch (sortBy) {
          case "nameAsc":
            sortObj = { scholarshipName: 1 };
            break;
          case "nameDesc":
            sortObj = { scholarshipName: -1 };
            break;
          case "rankAsc":
            sortObj = { universityWorldRank: 1 };
            break;
          case "rankDesc":
            sortObj = { universityWorldRank: -1 };
            break;
          case "postDateAsc":
            sortObj = { scholarshipPostDate: 1 };
            break;
          case "postDateDesc":
            sortObj = { scholarshipPostDate: -1 };
            break;
        }

        const skip = (Number(page) - 1) * Number(limit);

        const total = await universityCollection.countDocuments(query); // total docs
        const result = await universityCollection
          .find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(Number(limit))
          .toArray();

        res.send({
          data: result,
          total,
          page: Number(page),
          limit: Number(limit),
        });
      } catch (error) {
        console.error("Error fetching scholarships:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });
    app.get("/allScholarships", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const result = await universityCollection
          .find({})
          .toArray();

        res.send(result);
      } catch (error) {
        console.error("Error fetching all scholarships:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });
    app.patch("/managesholarship/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updateData = req.body;

        // Ensure id is valid ObjectId
        const filter = { _id: new ObjectId(id) };

        // Only send fields that exist
        const updateDoc = { $set: updateData };

        const result = await universityCollection.updateOne(filter, updateDoc);

        res.send({
          success: true,
          message: "Scholarship updated successfully",
          result,
        });
      } catch (error) {
        console.error("PATCH Error:", error);
        res.status(500).send({
          success: false,
          message: "Server error while updating scholarship",
        });
      }
    });

    app.delete("/managescholarshipdelete/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };

        const result = await universityCollection.deleteOne(filter);

        if (result.deletedCount > 0) {
          res.send({
            success: true,
            message: "Scholarship deleted successfully",
            result,
          });
        } else {
          res.send({
            success: false,
            message: "Scholarship not found",
          });
        }
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    app.post("/scholarship", async (req, res) => {
      try {
        const data = req.body;
        const result = await universityCollection.insertOne(data);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to add scholarship" });
      }
    });

    app.get("/scholarships/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const scholarship = await universityCollection.findOne(query);

        if (!scholarship) {
          return res.status(404).send({ message: "Scholarship not found" });
        }

        res.send(scholarship);
      } catch (error) {
        res.status(500).send({ message: "Invalid ID or server error" });
      }
    });
    // review collection

    app.get("/review", verifyToken, async (req, res) => {
      try {
        const { scholarshipId, email } = req.query;

        let query = {};

        // Filter by scholarshipId
        if (scholarshipId) {
          query.scholarshipId = scholarshipId;
        }

        // Filter by email (optional)
        if (email) {
          query.userEmail = email;
        }

        const reviews = await reviewCollection
          .find(query)
          .sort({ postedAt: -1 })
          .toArray();

        res.send(reviews);
      } catch (error) {
        res.status(500).send({ message: "Server error" });
      }
    });
    app.get("/review/role/modaretor", verifyToken, async (req, res) => {
      try {
        const { scholarshipId, email } = req.query;

        let query = {};

        // Filter by scholarshipId
        if (scholarshipId) {
          query.scholarshipId = scholarshipId;
        }

        // Filter by email (optional)
        if (email) {
          query.userEmail = email;
        }

        const reviews = await reviewCollection
          .find(query)
          .sort({ postedAt: -1 })
          .toArray();

        res.send(reviews);
      } catch (error) {
        res.status(500).send({ message: "Server error" });
      }
    });

    app.delete("/role/modaretor/:id", async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid ID" });
        }

        const result = await reviewCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Review not found" });
        }

        res.send({
          success: true,
          message: "Review deleted successfully",
        });
      } catch (error) {
        res.status(500).send({ message: "Server error" });
      }
    });

    app.get("/review/:id", async (req, res) => {
      const id = req.params.id;
      const review = await reviewCollection.findOne({ _id: new ObjectId(id) });

      if (!review) {
        return res.status(404).send({ message: "Review not found" });
      }

      res.send(review);
    });

    app.post("/review", async (req, res) => {
      try {
        const reviewData = req.body;

        const newReview = {
          scholarshipId: reviewData.scholarshipId, // IMPORTANT ⭐
          userName: reviewData.userName,
          userEmail: reviewData.userEmail,
          userPhoto: reviewData.userPhoto || "",
          universityName: reviewData.universityName,
          scholarshipName: reviewData.scholarshipName,
          rating: Number(reviewData.rating),
          reviewText: reviewData.reviewText,
          postedAt: new Date(),
        };

        const result = await reviewCollection.insertOne(newReview);

        res.send({
          success: true,
          message: "Review posted successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ success: false, message: "Failed to post review" });
      }
    });
    app.delete("/review/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await reviewCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/review/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { reviewText, rating } = req.body;

        if (!reviewText && rating === undefined) {
          return res
            .status(400)
            .send({ success: false, message: "Nothing to update" });
        }

        const updateFields = {};
        if (reviewText) updateFields.reviewText = reviewText;
        if (rating !== undefined) updateFields.rating = Number(rating);
        updateFields.postedAt = new Date();

        const result = await reviewCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateFields }
        );

        if (result.modifiedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Review not found or no changes made",
          });
        }

        res.send({ success: true, message: "Review updated successfully" });
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ success: false, message: "Failed to update review" });
      }
    });

    // application related api

    app.post("/application", async (req, res) => {
      try {
        const {
          scholarshipId,
          userId,
          userName,
          userEmail,
          universityName,
          scholarshipCategory,
          degree,
          applicationFees,
          serviceCharge,
        } = req.body;

        const trackingId = generateTrackingId("APP"); // generate tracking ID

        // Basic validation
        if (
          !scholarshipId ||
          !userId ||
          !userName ||
          !userEmail ||
          !universityName
        ) {
          return res.status(400).send({ message: "Missing required fields." });
        }

        const newApplication = {
          scholarshipId,
          userId,
          userName,
          userEmail,
          universityName,
          scholarshipCategory: scholarshipCategory || "",
          degree: degree || "",
          applicationFees: Number(applicationFees) || 0,
          serviceCharge: Number(serviceCharge) || 0,
          applicationStatus: "pending",
          paymentStatus: "unpaid",
          applicationDate: new Date(),
          feedback: "",
          trackingId,
        };
        logTracking(trackingId, "apply_created");

        const result = await applicationsCollection.insertOne(newApplication);

        if (result.insertedId) {
          res.send({
            success: true,
            message: "Application submitted successfully.",
            trackingId, // optional: send trackingId back to client
          });
        } else {
          res
            .status(500)
            .send({ success: false, message: "Failed to submit application." });
        }
      } catch (error) {
        console.error("POST /application error:", error);
        res.status(500).send({ success: false, message: "Server error." });
      }
    });
    app.get("/application", verifyToken, async (req, res) => {
      try {
        const { email, status } = req.query;

        let query = {};
        if (email) query.userEmail = email;
        if (status) query.applicationStatus = status;

        const applications = await applicationsCollection
          .find(query)
          .sort({ applicationDate: -1 })
          .toArray();

        res.send({ success: true, data: applications });
      } catch (error) {
        console.error("GET /application error:", error);
        res.status(500).send({ success: false, message: "Server error." });
      }
    });
    app.get("/application/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .send({ success: false, message: "Invalid application ID." });
        }

        const application = await applicationsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!application) {
          return res
            .status(404)
            .send({ success: false, message: "Application not found." });
        }

        res.send({ success: true, data: application });
      } catch (error) {
        console.error("GET /application/:id error:", error);
        res.status(500).send({ success: false, message: "Server error." });
      }
    });

    app.delete("/application/:id", async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .send({ success: false, message: "Invalid application ID" });
        }

        const result = await applicationsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount > 0) {
          res.send({
            success: true,
            message: "Application deleted successfully",
          });
        } else {
          res
            .status(404)
            .send({ success: false, message: "Application not found" });
        }
      } catch (error) {
        console.error("DELETE /application/:id error:", error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });
    app.patch("/application/feedback/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { feedback } = req.body; // frontend theke feedback ashbe

        if (!feedback) {
          return res.status(400).send({
            success: false,
            message: "Feedback is required",
          });
        }

        const result = await applicationsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              feedback: feedback, // feedback update
              updatedAt: new Date(), // optional
            },
          }
        );

        if (result.modifiedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Application not found or feedback unchanged",
          });
        }

        res.send({
          success: true,
          message: "Feedback updated successfully",
        });
      } catch (error) {
        console.error(error);
        res.status(500).send({
          success: false,
          message: "Server error",
        });
      }
    });

    app.patch("/application/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updates = req.body;

        Object.keys(updates).forEach((key) => {
          if (updates[key] === "" || updates[key] === undefined)
            delete updates[key];
        });

        const result = await applicationsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updates }
        );

        if (result.modifiedCount > 0)
          return res.send({ success: true, message: "Application updated" });

        res.status(404).send({
          success: false,
          message: "No update applied",
        });
      } catch (error) {
        console.error("PATCH ERROR:", error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    // payment related api
    app.post("/payment-checkout-session", async (req, res) => {
      try {
        const applicationInfo = req.body;

        // Convert application fee to cents
        const amount =
          (parseInt(applicationInfo.applicationFees) +
            parseInt(applicationInfo.serviceCharge)) *
          100;

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
          line_items: [
            {
              price_data: {
                currency: "usd",
                unit_amount: amount,
                product_data: {
                  name: `Payment for: ${applicationInfo.scholarshipName}`,
                  description: `University: ${applicationInfo.universityName}`,
                },
              },
              quantity: 1,
            },
          ],

          mode: "payment",

          // ==============================
          //         ALL METADATA
          // ==============================
          metadata: {
            applicationId: applicationInfo._id,
            scholarshipId: applicationInfo.scholarshipId,
            scholarshipName: applicationInfo.scholarshipName,
            universityName: applicationInfo.universityName,
            postedUserEmail: applicationInfo.postedUserEmail,
            userName: applicationInfo.userName,
            userEmail: applicationInfo.userEmail,
            degree: applicationInfo.degree,
            category: applicationInfo.scholarshipCategory,
            applicationFees: applicationInfo.applicationFees,
            serviceCharge: applicationInfo.serviceCharge,
            paymentStatus: "paid",
            trackingId: applicationInfo.trackingId,
          },

          customer_email: applicationInfo.userEmail,

          success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          // cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
          cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled?trackingId=${applicationInfo.trackingId}`,
        });
        // console.log(session.url)
        res.send({ url: session.url });
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Stripe Checkout Session Failed" });
      }
    });

    app.patch("/payment-success", async (req, res) => {
      // 1. Get the session ID from the query parameters
      //     console.log("🔥 Payment endpoint hit");
      // console.log("Query params:", req.query);
      const sessionId = req.query.session_id;

      if (!sessionId) {
        return res
          .status(400)
          .send({ error: "Missing session_id query parameter." });
      }

      try {
        // 2. Retrieve the Stripe session details and assign it to the 'session' variable
        // This is the CRITICAL fix:
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        console.log(session);
        // console.log("Metadata:", session.metadata);
        // Extract transaction ID (payment_intent)
        const transactionId = session.payment_intent;

        // Use the tracking ID saved in metadata during session creation
        const trackingId = session.metadata.trackingId;

        // 3. Check if a payment record with this transaction ID already exists
        const query = { transactionId: transactionId };
        const paymentExist = await trackingsCollection.findOne(query);

        if (paymentExist) {
          // Already processed, send success response
          return res.send({
            success: true,
            message: "Payment already processed and recorded.",
            transactionId,
            trackingId: paymentExist.trackingId,
          });
        }

        // 4. Check if the payment was successful
        if (session.payment_status === "paid") {
          // Get the application details from the session metadata
          const applicationId = session.metadata.applicationId;

          // --- Update the Application Payment Status ---
          // Ensure ObjectId is imported: const { ObjectId } = require('mongodb');
          const applicationQuery = { _id: new ObjectId(applicationId) };
          const applicationUpdate = {
            $set: {
              paymentStatus: "paid", // Update status to paid
              applicationStatus: "completed",
            },
          };

          // Execute the update
          const resultApplicationUpdate =
            await applicationsCollection.updateOne(
              applicationQuery,
              applicationUpdate
            );

          // --- Insert New Payment Record ---
          const payment = {
            amount: session.amount_total / 100,
            currency: session.currency,
            customerEmail: session.customer_email,

            // Metadata from the session to save
            applicationId: applicationId,
            scholarshipId: session.metadata.scholarshipId,
            scholarshipName: session.metadata.scholarshipName,
            universityName: session.metadata.universityName,
            userName: session.metadata.userName,

            transactionId: transactionId,
            paymentStatus: session.payment_status,
            paidAt: new Date(),
            trackingId: trackingId,
          };

          // Execute the payment insertion into the CORRECT collection
          const resultPaymentInsert = await trackingsCollection.insertOne(
            // <--- CORRECTED LINE
            payment
          );
          // logTracking(trackingId, 'paid')

          // 5. Send successful response
          return res.send({
            success: true,
            message: "Payment and application status updated successfully.",
            updateApplication: resultApplicationUpdate,
            trackingId: trackingId,
            transactionId: transactionId,
            paymentInfo: resultPaymentInsert,
          });
        }

        // If payment_status is not 'paid' (e.g., 'unpaid', 'no_payment_required')
        return res.send({
          success: false,
          message: "Payment not successful or session status is not paid.",
          paymentStatus: session.payment_status,
        });
      } catch (error) {
        console.error("Error in payment-success endpoint:", error);
        // Include the actual error in the 500 response for better debugging in development
        res.status(500).send({
          error: "Stripe success processing failed",
          details: error.message,
        });
      }
    });

    app.post("/payment-cancel", async (req, res) => {
      const { trackingId } = req.body;
      if (!trackingId)
        return res.status(400).send({ error: "Missing trackingId" });

      try {
        const result = await logTracking(trackingId, "payment-canceled");
        res.send({ success: true, result });
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to log canceled payment" });
      }
    });

    // Moderator related api
    app.patch("/rolemoderator/:id", async (req, res) => {
      const id = req.params.id;
      const { action, feedback, trackingId } = req.body;

      try {
        let updateData = {};

        if (action === "approved") {
          updateData = {
            applicationStatus: "approved",
            // paymentStatus: "paid",
            feedback: feedback || "",
          };
          logTracking(trackingId, "apply-approved");
        }

        if (action === "cancel") {
          updateData = {
            applicationStatus: "rejected",
            // paymentStatus: "unpaid",
            feedback: feedback || "",
          };
          logTracking(trackingId, "apply-canceled");
        }

        const result = await applicationsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );

        res.send({
          success: true,
          message: "Application updated successfully",
          result,
        });
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: "Update failed" });
      }
    });
    // tracking related api
    app.get("/tracking", async (req, res) => {
      try {
        // const trackingsCollection = db.collection("trackings");

        // Fetch all tracking documents
        const allTrackings = await trackingsCollection.find({}).toArray();

        res.send({
          success: true,
          data: allTrackings,
        });
      } catch (err) {
        console.error("Error fetching trackings:", err);
        res.status(500).send({
          success: false,
          error: "Failed to fetch tracking records",
        });
      }
    });

    app.get("/trackings/:trackingId",verifyIdToken, async (req, res) => {
      const trackingId = req.params.trackingId;
      // console.log(trackingId)
      const query = { trackingId };
      const result = await trackingsCollection.find(query).toArray();
      res.send(result);
    });
  } catch (err) {
    console.error(err);
  }
}

run();

// Default route
app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
