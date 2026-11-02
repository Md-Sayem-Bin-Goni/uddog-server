import express from "express"
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config';
import cors from "cors";
import { createRemoteJWKSet, jwtVerify } from "jose";


const app = express()
const port = process.env.PORT || 8000

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

// Get today's date (YYYY-MM-DD) in Bangladesh timezone
const getTodayBD = () =>
    new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Dhaka",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());




const JWKS = createRemoteJWKSet(
    new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
);

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send({ msg: "Unauthorized!" });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).send({ msg: "Unauthorized!" });
    }

    try {
        const { payload } = await jwtVerify(token, JWKS);
        req.user = payload;
        next();

    } catch (error) {
        console.log(error.message);
        return res.status(401).send({ msg: "Invalid Token!" });
    }
};




app.get('/', (req, res) => {
    res.send('HELLO WORLD');
});




app.post("/add-events", verifyToken, async (req, res) => {
    try {
        const result = await eventCollection.insertOne({
            ...req.body,
            createdBy: req.user.email,
            createdAt: new Date(),
        })

        res.send({
            success: true,
            message: "Event created successfully",
            insertedId: result.insertedId,
        })
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Failed to create event",
            error: error.message,
        })
    }
})




app.get("/all-events", async (req, res) => {
    try {
        const today = getTodayBD();

        const result = await eventCollection
            .find({ eventDate: { $gte: today } })
            .sort({ eventDate: 1 })
            .toArray();

        res.send({
            success: true,
            events: result,
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Failed to fetch events",
            error: error.message,
        });
    }
});








app.get("/my-created-events/:email", verifyToken, async (req, res) => {
    try {
        const email = req.params.email

        if (req.user.email !== email) {
            return res.status(403).send({ msg: "Forbidden: email mismatch" })
        }

        const result = await eventCollection
            .find({ createdBy: email })
            .toArray()

        res.send(result)
    } catch (error) {
        res.status(500).send({ success: false, message: "Failed to fetch events", error: error.message })
    }
})





app.get("/all-events/:id", async (req, res) => {
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
    try {
        const { eventId } = req.body;
        const email = req.user.email;

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
        const result = await registrationCollection.insertOne({
            ...req.body,
            email,
        });

        res.send({
            message: "Successfully joined the event!",
            insertedId: result.insertedId
        });
    } catch (error) {
        res.status(500).send({
            message: "Failed to join event",
            error: error.message,
        });
    }
});






app.get("/my-joined-events/:email", verifyToken, async (req, res) => {
    try {
        const email = req.params.email

        if (req.user.email !== email) {
            return res.status(403).send({ msg: "Forbidden: email mismatch" })
        }

        const today = getTodayBD()

        const result = await registrationCollection
            .find({
                email: email,
                eventDate: { $gte: today }
            })
            .sort({ eventDate: 1 })
            .toArray()

        res.send(result)
    } catch (error) {
        res.status(500).send({ success: false, message: "Failed to fetch joined events", error: error.message })
    }
})







app.delete("/delete-event/:id", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        const event = await eventCollection.findOne({ _id: new ObjectId(id) });

        if (!event) {
            return res.status(404).send({ message: "Event not found" });
        }

        if (event.createdBy !== req.user.email) {
            return res.status(403).send({ message: "Forbidden: not your event" });
        }

        await eventCollection.deleteOne({ _id: new ObjectId(id) });

        res.send({
            success: true,
            message: "Event deleted successfully"
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Failed to delete event",
            error: error.message,
        });
    }
});








app.put("/update-event/:id", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        const event = await eventCollection.findOne({ _id: new ObjectId(id) });

        if (!event) {
            return res.status(404).send({ message: "Event not found" });
        }

        if (event.createdBy !== req.user.email) {
            return res.status(403).send({ message: "Forbidden: not your event" });
        }

        const { _id, createdBy, createdAt, ...updatedEvent } = req.body;

        await eventCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updatedEvent }
        );

        res.send({
            success: true,
            message: "Event updated successfully"
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Failed to update event",
            error: error.message,
        });
    }
});







app.get("/upcoming-events", async (req, res) => {
    try {
        const today = getTodayBD();

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

export default app;
