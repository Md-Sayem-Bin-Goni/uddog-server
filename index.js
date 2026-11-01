import express from "express"
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config';
import cors from "cors";
// import { createRemoteJWKSet, jwtVerify } from "jose";


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




app.get('/', (req, res) => {
    res.send('HELLO WORLD');
});




app.post("/add-events", async (req, res) => {
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

app.get("/my-created-events/:email", async (req, res) => {
    const email = req.params.email

    const result = await eventCollection
        .find({ createdBy: email })
        .toArray()

    res.send(result)
})

app.get("/events", async (req, res) => {
    const result = await eventCollection.find().toArray();

    res.send({
        success: true,
        events: result,
    });
});


app.get("/events/:id", async (req, res) => {
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




app.post("/join-event", async (req, res) => {
    console.log("joined trigger");
    const joinData = req.body

    const result = await registrationCollection.insertOne(joinData)

    res.send(result)
})


app.get("/my-joined-events/:email", async (req, res) => {
    const email = req.params.email

    const result = await registrationCollection
        .find({ email: email })
        .toArray()

    res.send(result)
})


app.delete("/delete-event/:id", async (req, res) => {
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



app.put("/update-event/:id", async (req, res) => {
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


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})


