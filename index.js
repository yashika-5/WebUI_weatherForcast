const aws = require('aws-sdk')
const express = require('express')
const app = express()
const fs = require('fs')
const path = require('path')
const body_parser = require('body-parser')
const uuid = require('uuid/v4')
const session = require('express-session')
const file_store = require('session-file-store')(session)
const passport = require('passport')
const local_strategy = require('passport-local').Strategy
const multer = require('multer')
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'tempupload')
    },
    filename: function (req, file, cb) {
      cb(null, file.fieldname + '-' + req.session.passport.user)
    }
  })
var  tempupload = multer({storage: storage})




require('dotenv').config()
const port = 45454
aws.config.update ({
    "region": "ap-south-1",
    "accessKeyId": process.env.AWS_ACCESS_KEY,
    "secretAcesssKey": process.env.AWS_SECRET_ACCESS
    });
const db = new aws.DynamoDB();
const usr_table = process.env.TABLE_NAME 
const s3 = new aws.S3()
const bucket_name = process.env.BUCKET_NAME
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
        res.render('uploadfile')
    }
    else {
        res.redirect('/login')
    }
})


app.post('/uploadfile', tempupload.single('datacsv'), (req,res, next) => {
    if(req.isAuthenticated()) {
        var file = req.file
        fs.readFile('tempupload/datacsv-'+req.session.passport.user, (err, content) => {
            // res.writeHead(404, { 'Content-Type': 'Csvdata' });
            console.log(content.toString().split('\n')[0].split(','))
            const param_to_upload_csv = {
                Bucket: bucket_name,
                Key: `${req.session.passport.user}/data.csv`,
                Body: content.toString()
            }
            s3.upload(param_to_upload_csv, (s3err, content) => {
                console.log(`File uploaded successfully at ${content.Location}`)
            })
            fs.unlinkSync('tempupload/datacsv-'+req.session.passport.user)
        })
        res.send("uploaded")
        
    }
    else {
        res.redirect('/login') 
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
app.post('/create', (req,res) => {
    // console.log('postreq -> ', req.body.fullname, req.body.pass, req.body.email, req.body.contact)
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
    res.redirect('/login')
})

app.listen(port,(err)=>{
    if(err) console.log(err)
    else console.log(`server running    -->  on ${port}`)
})