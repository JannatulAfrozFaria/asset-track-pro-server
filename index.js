const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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
    const packagesCollection = client.db("AssetTrackPro").collection("packages");

    //middlewares for verifying token
    const verifyToken = (req,res,next) =>{
        console.log( 'inside verify token', req.headers.authorization);
        if(!req.headers.authorization){
            return res.status(401).send({message: 'unauthorized access', HR:false})
        }
        const  token = req.headers.authorization.split(' ')[1];
        jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
            if(err){
                return res.status(401).send({message: 'unauthorized access', HR:false})
            }
            req.decoded = decoded;
            next();
        })
    }
    //use verifyHR after verifyToken
    const verifyHR = async(req,res,next)=>{
        const email = req.decoded.email;
        // console.log( 'EMAIL ID : ', email);
        const query = {email: email};
        const user = await userCollection.findOne(query);
        console.log(user);
        const isHR = user?.role === 'HR';
        if(!isHR){
            // console.log('HR manager')
            // return res.status(403).send({message: 'forbidden access'});
            return res.send({ HR: false});
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
    app.get('/users/admin/:email', verifyToken, verifyHR, async(req,res)=>{
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
    //Load-------All Assets--------
    app.get('/assets', async(req,res)=>{
        const result = await assetCollection.find().toArray();
        res.send(result);
    })
    //Adding new assets to the assets collection
    app.post('/assets', verifyToken, verifyHR, async(req,res)=>{
        const item =  req.body;
        const result = await assetCollection.insertOne(item);
        res.send(result);
    })
    //opening a different api for updating info of a specific Asset(Update An Asset Page of UI)
    app.get('/assets/:id',async(req,res)=>{
        const id =  req.params.id;
        const query =  {_id: new ObjectId(id)}
        const result =  await assetCollection.findOne(query);
        res.send(result);
    })
    //updating the data of a specific asset(Update Function of Update an Asset Page of UI)
    app.patch('/assets/:id',async(req,res)=>{
        const asset = req.body;
        const id = req.params.id;
        const filter = {_id: new ObjectId(id)}
        const updatedAsset = {
            $set: {
                name: asset.name,
                type: asset.type,
                quantity: asset.quantity,
                stock: asset.stock,
                date_added: asset.date_added,
                image: asset.image
            }
        }
        const result = await assetCollection.updateOne(filter,updatedAsset);
        res.send(result);
    })
     //for deleting  Asset from Asset list(Admin's Page)
    app.delete('/assets/:id', verifyToken, verifyHR, async(req,res)=>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)}
        const result = await assetCollection.deleteOne(query)
        res.send(result);
    })

   
    //request related api
    //---------------------------------------------
    //getting user specific request
    app.get('/requests/:email',async(req,res)=>{
        const email = req.params.email;
        console.log(email);
        const query = {email : email};
        const result = await requestCollection.find(query).toArray();
        // console.log(result);
        res.send(result);
    })

    //---------------------------------------------
    //loading all users requested asset
    app.get('/requests', async(req,res)=>{
        const result = await requestCollection.find().toArray();
        res.send(result);
    })
    //creating the request collection
    app.post('/requests',async(req,res)=>{
        const requestedAsset = req.body;
        const result = await requestCollection.insertOne(requestedAsset);
        res.send(result);
    })
    //updating the approval date in request
    app.patch('/approve/:id',async(req,res)=>{
        const id = req.params.id;
        const filter = {_id: new ObjectId(id)};

        const currentDate = new Date();
        const formattedDate = `${currentDate.getFullYear()}/${String(currentDate.getMonth() + 1).padStart(2, '0')}/${String(currentDate.getDate()).padStart(2, '0')}`;

        const updateDoc = {
            $set: {
                status: 'Approved',
                approval_date: formattedDate
            }
        }
        const result = await requestCollection.updateOne(filter,updateDoc)
        console.log(result);
        if(result.modifiedCount>0){
            const modifiedData = await requestCollection.find().toArray();
            res.send({modifiedData,formattedDate});
            return modifiedData;
            
        }else{
            return res.send({message: 'no modification'})
        }
        
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
    //loading user specific employee asset
    app.get('/employees', async(req,res)=>{
        const result = await employeeCollection.find().toArray();
        res.send(result);
    })
    //adding the new employee to the employee collection
    app.post('/employees',async(req,res)=>{
        const requestedEmployee = req.body;
        const query = {email: req.body.email}
        console.log(query);
        const employee = await employeeCollection.findOne(query);
        console.log(employee);
        if(!employee){
            const result = await employeeCollection.insertOne(requestedEmployee);
            res.send(result);
        }
        else{
            return res.send({message: 'Employee already exists in your team', insertedId: null})
        }
    })
    //for deleting  employee from the requested asset list
    app.delete('/employees/:id', async(req,res)=>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)}
        const result = await employeeCollection.deleteOne(query)
        res.send(result);
    });

     //------------PACKAGES---------------
     app.get('/packages', async(req,res)=>{
        const result = await packagesCollection.find().toArray();
        res.send(result);
    })
    //opening a different api for updating info of a specific Asset(Update An Asset Page of UI)
    app.get('/packages/:id',async(req,res)=>{
        const id =  req.params.id;
        const query =  {_id: new ObjectId(id)}
        const result =  await packagesCollection.findOne(query);
        res.send(result);
    })

    //payment
    app.post('/create-payment-intent',async(req,res)=>{
        const {price} = req.body;
        const amount = parseInt(price*100);
        console.log(amount, 'amount inside the intent')
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: "usd",
            payment_method_types: ['card']
        });
        res.send({
            clientSecret: paymentIntent.client_secret,
        });
    });
    app.post('/payments',async(req,res)=>{
        const payment = req.body;
    })

    //PIE----CHART---BY----AGGREGATE---PIPELINE
    app.get('/request-stats',async(req,res)=>{
        const result = await requestCollection.aggregate([
            // {
            //     $unwind: '$'
            // },
            {
                $lookup:{
                    from: 'assets',
                    localField: 'assetId',
                    foreignField: '_id',
                    as: 'assetId'
                }
            },
            {
                $group:{
                    _id: 'type'
                }
            }
        ]).toArray();
        res.send(result);
    })


    // opening a different api for updating info of a specific User
    app.get('/updateProfile/:email',async(req,res)=>{
        const id =  req.params.email;
        const query =  {_id: new ObjectId(id)}
        const result =  await userCollection.findOne(query);
        res.send(result);
    })
    //updating the data of a specific user Profile
    app.patch('/updateProfile/:email',async(req,res)=>{
        const user = req.body;
        console.log(user);
        const email = req.params.email;
        const filter = {_id: new ObjectId(email)}
        const updatedProfile = {
            $set: {
                displayName: user.displayName,
                photoURL: user.photoURL
            }
        }
        const result = await userCollection.updateOne(filter,updatedProfile);
        res.send(result);

        console.log(result);
        // if(result.modifiedCount>0){
        //     const modifiedData = await userCollection.find().toArray();
        //     res.send({modifiedData,formattedDate});
        //     return modifiedData;
            
        // }else{
        //     return res.send({message: 'no modification'})
        // }
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