const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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

const uri = process.env.URI;

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
    await client.connect();
    console.log("Connected to MongoDB!");

    const db = client.db("Scholarship-Management-System");
    const userCollection = db.collection("user");
    const universityCollection = db.collection("university");
    const reviewCollection = db.collection("review");

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
    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await userCollection.findOne(query);
      res.send({ role: user?.role || "student" });
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

    app.get("/scholarshipUniversity", async (req, res) => {
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
      } = req.query;

      if (email) query.postedUserEmail = email;
      if (universityName) query.universityName = universityName;
      if (universityCountry) query.universityCountry = universityCountry;
      if (subjectCategory) query.subjectCategory = subjectCategory;
      if (scholarshipCategory) query.scholarshipCategory = scholarshipCategory;
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

      const result = await universityCollection
        .find(query)
        .sort({ scholarshipPostDate: -1 })
        .toArray();

      res.send(result); // এখন আর এরর আসবে না
    });
    // 6934201901492016fbc39033
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

    app.get("/review", async (req, res) => {
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

    app.get("/review/:id", async (req, res) => {
      const id = req.params.id;
      const review = await reviewCollection.findOne({ _id: id });

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
