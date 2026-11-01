import express from "express"
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config';
import cors from "cors";
import { createRemoteJWKSet, jwtVerify } from "jose";


const app = express()
const port = 8000

app.use(cors())
app.use(express.json())


const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
    try {
        await client.connect();
        console.log("You successfully connected to MongoDB!");
        return client;
    } catch (err) {
        console.dir(err);
    }
}


const mongoclient = await connectToMongoDB()
const db = mongoclient.db("uddog_project_db")
const eventCollection = db.collection('events')
const registrationCollection = db.collection("joined");


const JWKS = createRemoteJWKSet(
    new URL("http://localhost:3000/api/auth/jwks")
);


const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    // Check Authorization header
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).send({
            message: "Unauthorized! Token missing."
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        // Verify JWT
        const { payload } = await jwtVerify(token, JWKS, {
            issuer: "http://localhost:3000",
            audience: "http://localhost:3000",
        });

        // Store user information
        req.user = payload;

        next();

    } catch (error) {
        console.error("JWT verification failed:", error.message);

        return res.status(401).send({
            message: "Invalid or expired token."
        });
    }
};

// const verifyToken = async (req, res, next) => {
//     const authHeader = req.headers.authorization;

//     if (!authHeader) {
//         return res.status(401).send({ msg: "Unauth" })
//     }

//     const token = authHeader.split(" ")[1]

//     if (!token) {
//         return res.status(401).send({ msg: "Unauthorized!" });
//     }


//     const JWKS = createRemoteJWKSet(
//         new URL('http://localhost:3000/api/auth/jwks')
//     )

//     try {
//         const { payload } = await jwtVerify(token, JWKS)
//         next()
//     } catch (error) {
//         return res.status(500).send({ msg: "Server Error!" });

//     }
// }




app.get('/', (req, res) => {
    res.send('HELLO WORLD');
});






app.post("/add-events", verifyToken, async (req, res) => {
    const eventData = req.body

    const result = await eventCollection.insertOne({
        ...eventData,
        createdAt: new Date(),
    })

    res.send({
        success: true,
        message: "Event created successfully",
        insertedId: result.insertedId,
    })
})

app.get("/my-created-events/:email", verifyToken, async (req, res) => {
    const email = req.params.email

    const result = await eventCollection
        .find({ createdBy: email })
        .toArray()

    res.send(result)
})

app.get("/all-events", async (req, res) => {
    const result = await eventCollection.find().toArray();

    res.send({
        success: true,
        events: result,
    });
});


app.get("/events/:id", verifyToken, async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).send({
            success: false,
            message: "Invalid event id",
        });
    }

    const event = await eventCollection.findOne({ _id: new ObjectId(id) });

    if (!event) {
        return res.status(404).send({
            success: false,
            message: "Event not found",
        });
    }

    res.send({
        success: true,
        event,
    });
});




app.post("/join-event", verifyToken, async (req, res) => {
    const { eventId, email } = req.body;

    // Check if the user already joined this event
    const alreadyJoined = await registrationCollection.findOne({
        eventId: eventId,
        email: email
    });

    if (alreadyJoined) {
        return res.status(409).send({
            message: "You have already joined this event!"
        });
    }

    // Insert registration only if not already joined
    const result = await registrationCollection.insertOne(req.body);

    res.send({
        message: "Successfully joined the event!",
        insertedId: result.insertedId
    });
});




app.get("/my-joined-events/:email", verifyToken, async (req, res) => {
    const email = req.params.email

    const today = new Date().toISOString().split("T")[0]

    const result = await registrationCollection
        .find({
            email: email,
            eventDate: { $gte: today }
        })
        .sort({ eventDate: 1 })
        .toArray()

    res.send(result)
})

app.delete("/delete-event/:id", verifyToken, async (req, res) => {
    const { id } = req.params;

    const result = await eventCollection.deleteOne({
        _id: new ObjectId(id)
    });

    if (result.deletedCount === 0) {
        return res.status(404).send({
            message: "Event not found"
        });
    }

    res.send({
        success: true,
        message: "Event deleted successfully"
    });
});



app.put("/update-event/:id", verifyToken, async (req, res) => {
    const { id } = req.params;
    const updatedEvent = req.body;

    const result = await eventCollection.updateOne(
        { _id: new ObjectId(id) },
        {
            $set: updatedEvent
        }
    );

    if (result.matchedCount === 0) {
        return res.status(404).send({
            message: "Event not found"
        });
    }

    res.send({
        success: true,
        message: "Event updated successfully"
    });
});


app.get("/upcoming-events", async (req, res) => {
    try {
        const today = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Dhaka",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(new Date());

        const result = await eventCollection
            .find({ eventDate: { $gte: today } })
            .sort({ eventDate: 1 })
            .limit(6)
            .toArray();

        res.send(result);

    } catch (error) {
        res.status(500).send({
            message: "Failed to fetch upcoming events",
            error: error.message,
        });
    }
});



app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})


