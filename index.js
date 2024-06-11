const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
    const userCollection = client.db("AssetTrackPro").collection("users");
    const employeeCollection = client.db("AssetTrackPro").collection("employees");

    //middlewares for verifying token
    const verifyToken = (req,res,next) =>{
        // console.log( 'inside verify token', req.headers.authorization);
        if(!req.headers.authorization){
            return res.status(401).send({message: 'unauthorized access'});
        }
        const  token = req.headers.authorization.split(' ')[1];
        jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
            if(err){
                return res.status(401).send({message: 'unauthorized access'})
            }
            req.decoded = decoded;
            next();
        })
    }
    //use verifyHR after verifyToken
    const verifyHR = async(req,res,next)=>{
        const email = req.decoded.email;
        const query = {email: email};
        const user = await userCollection.findOne(query);
        const isHR = user?.role === 'HR';
        if(!isHR){
            return res.status(403).send({message: 'forbidden access'});
        }
        next();
    }

    //jwt related api
    app.post('/jwt',async(req,res)=>{
        const user = req.body;
        const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{
        expiresIn: '1h'});
        res.send({token});
    })
    

    //users related api
    
    //all USERS /  EMPLOYEE---List
    app.get('/users', verifyToken, verifyHR, async(req,res)=>{
        const result = await userCollection.find().toArray();
        res.send(result);
    })
    app.get('/users/admin/:email', verifyToken, async(req,res)=>{
        const email = req.params.email;
        if(email !== req.decoded.email){
            return res.status(403).send({message: 'forbidden access'})
        }
        const query = {email: email};
        const user =  await userCollection.findOne(query);
        let HR = false;
        if(user){
            HR = user?.role === 'HR';
        }
        res.send({HR});
    })
    //sending users data to database collection
    app.post('/users',async(req,res)=>{
        const user = req.body;
        //insert email if user doesn't exists: //u can do this many ways
        //1. email unique check //2. upset , 3. simple checking
        const query =  {email: user.email}
        const existingUser = await userCollection.findOne(query);
        if(existingUser){
            return res.send({message: 'user already exists', insertedId: null})
        }
        const result = await userCollection.insertOne(user);
        res.send(result);
    })

    //For MAKING ADMIN------
    app.patch('/users/admin/:id', verifyToken, verifyHR, async(req,res)=>{
        const id = req.params.id;
        const filter = {_id: new ObjectId(id)};
        const updateDoc = {
            $set: {
                role: 'HR'
            }
        }
        const result = await userCollection.updateOne(filter,updateDoc)
        res.send(result);
    })
    app.delete('/users/:id', verifyToken, verifyHR, async(req,res)=>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)}
        const result = await userCollection.deleteOne(query);
        res.send(result)
    })


    //-------------ASSETS------ related api
    //All Assets--------
    app.get('/assets', async(req,res)=>{
        const result = await assetCollection.find().toArray();
        res.send(result);
    })
    //Adding new assets to the assets collection
    app.post('/assets',async(req,res)=>{
        const item =  req.body;
        const result = await menuCollection.insertOne(item);
        res.send(result);
    })


    //request related api
    //loading user specific requested asset
    app.get('/requests', async(req,res)=>{
        const email = req.query.email;
        const query = {email: email};
        const result = await requestCollection.find(query).toArray();
        res.send(result);
    })
    //creating the request collection
    app.post('/requests',async(req,res)=>{
        const requestedAsset = req.body;
        const result = await requestCollection.insertOne(requestedAsset);
        res.send(result);
    })
    //updating the approval date in request
    app.patch('/requests/:id',async(req,res)=>{
        const id = req.params.id;
        const filter = {_id: new ObjectId(id)};

        const currentDate = new Date();
        const formattedDate = `${currentDate.getFullYear()}/${String(currentDate.getMonth() + 1).padStart(2, '0')}/${String(currentDate.getDate()).padStart(2, '0')}`;

        const updateDoc = {
            $set: {
                approval_date: formattedDate
            }
        }
        const result = await userCollection.updateOne(filter,updateDoc)
        res.send(result);
    })
    //for cancelling  Asset from the requested asset list
    app.delete('/requests/:id', async(req,res)=>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)}
        const result = await requestCollection.deleteOne(query)
        res.send(result);
    })


    //-------------------------------------------------------------
    //EMPLOYEE----- related api
    //loading user specific requested asset
    app.get('/employees', async(req,res)=>{
        const email = req.query.email;
        const query = {email: email};
        const result = await employeeCollection.find(query).toArray();
        res.send(result);
    })
    //creating the request collection
    app.post('/employees',async(req,res)=>{
        const requestedEmployee = req.body;
        const result = await employeeCollection.insertOne(requestedEmployee);
        res.send(result);
    })
    //for cancelling  Asset from the requested asset list
    app.delete('/employees/:id', async(req,res)=>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)}
        const result = await employeeCollection.deleteOne(query)
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