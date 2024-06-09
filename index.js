const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.sirqfba.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const assetCollection = client.db("AssetTrackPro").collection("assets");
    const requestCollection = client.db("AssetTrackPro").collection("requests");


    app.get('/assets', async(req,res)=>{
        const result = await assetCollection.find().toArray();
        res.send(result);
    })
    //request related api
    //creating the request collection
    app.post('/requests',async(req,res)=>{
        const requestedAsset = req.body;
        const result = await requestCollection.insertOne(requestedAsset);
        res.send(result);
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req,res)=>{
    res.send('Asset Track Pro is running')
})

app.listen(port, () =>{
    console.log(`Asset Track Pro is running on port ${port}`);
} )