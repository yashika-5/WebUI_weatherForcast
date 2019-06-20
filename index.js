const aws = require('aws-sdk')
const express = require('express')
const app = express()
const path = require('path')
const body_parser = require('body-parser')
const uuid = require('uuid/v4')
const session = require('express-session')
const file_store = require('session-file-store')(session)
const passport = require('passport')
const local_strategy = require('passport-local').Strategy



require('dotenv').config()
const port = 45454
aws.config.update ({
    "region": "ap-south-1",
    "accessKeyId": process.env.AWS_ACCESS_KEY,
    "secretAcesssKey": process.env.AWS_SECRET_ACCESS
    });
const db = new aws.DynamoDB();
const usr_table = "wf-user"
const s3 = new aws.S3()
const bucket_name = "wf-user-data"
var uid = 1

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.static(__dirname + "/public"))
app.use(express.static('public'))
app.use(body_parser.urlencoded({extended: true}));



passport.use(new local_strategy(
    (username, password, done) =>  {
        console.log("new local startegy")
      var param_for_login_check = {
        TableName: usr_table,
        "IndexName": "email-index",
        "ProjectionExpression": "email, pass, user_id",
        "KeyConditionExpression": "email = :v1",
        "ExpressionAttributeValues": {
            ":v1": {"S": username},
        },
    }
    db.query(param_for_login_check, (err, data_from_db ) => {
        if(err) {
            console.log("Error while Queryng database : " + err) 
        }
        else 
            console.log("query performed")
            console.log(data_from_db)
            if (data_from_db.Items.length == 0) {
                return done(null, false)
            }
            else {
                console.log(data_from_db.Items[0].pass.S)
                if(data_from_db.Items[0].pass.S == password ) {
                    user = {id: data_from_db.Items[0].user_id.S}
                    return done (null , user)
                }
                else return done(null, false)
            } 
            
        }
    )
    }
))

passport.serializeUser((user ,done) => {
    console.log("serialize")
    done (null, user.id)
})
passport.deserializeUser((id,done) => {
    console.log("deserialize")
    var user  = {id: id}
    done(null, id)
})
app.use(session({
    genid: (req) => {
        return uuid()
    },
    store: new file_store(),
    secret: process.env.PASSPORT_SECRET,
    resave: false,
    saveUninitialized: true
}))

app.use(passport.initialize())
app.use(passport.session())


app.get('/login' ,(req,res) => {
    res.render('login')
})

app.get('/uploadfile', (req,res) => {
    if(req.isAuthenticated()) {
        res.send("Authenticated sucessfully")
    }
    else {
        res.send("No acesss")
    }
})
app.post('/login', passport.authenticate( 'local' ,  { successRedirect: '/uploadfile', failureRedirect: '/login'}))
    




app.get('/', (req,res) => {
    if(req.isAuthenticated()) {
    res.send("done") }
    else {
        res.send("note done")
    }
})
app.get('/create', (req,res) => {
    res.render('signup')
} )
app.post('/upload', (req,res) => {
    console.log('postreq -> ', req.body.fullname, req.body.pass, req.body.email, req.body.contact)
    var new_user = { 
        user_id: {S: `u${uid}`},
        fullname: {S: req.body.fullname},
        pass: {S: req.body.pass},
        email: {S: req.body.email},
        contact: {N: req.body.contact},
        // nation: {S: req.body.nation},
    }
    params = {
        TableName: usr_table,
        Item: new_user,
    }
    
    db.putItem(params, (err, data) => {
        if (err) {
            console.log("Error", err);
          } else {
            console.log("Success", data);
            var param_s3 = {
                Bucket: bucket_name,
                Key: `u${uid}/`,
                Body: 'No matter'
            }
            s3.upload(param_s3, (err, data) => {
                if(err) {
                    console.log(err)
                }
                else {
                    console.log('upload done')
                    uid = uid + 1;
                }
            })
           
          }
        })
    res.send("successful")
})

app.get('/fetch', (req, res) => {

    var user_id = "u2"
    var params = {
        TableName: usr_table,
        "IndexName": "email-index",
        "ProjectionExpression": "email, pass, user_id",
        "KeyConditionExpression": "email = :v1",
        "ExpressionAttributeValues": {
            ":v1": {"S": "m@m"},
        },
    }
    
    db.query(params, function (err, data) {
        if (err) {
            console.log(err);
            handleError(err, res);
        } else {
            handleSuccess(data.Items, res);
        }
     })
    })
    function handleError(err, res) {
        res.json({ 'message': 'server side error', statusCode: 500, error: 
        err })
    }
    
    function handleSuccess(data, res) {
        res.json({ message: 'success', statusCode: 200, data: data[0].user_id.S })
    }



app.listen(port,(err)=>{
    if(err) console.log(err)
    else console.log(`server running    -->  on ${port}`)
})