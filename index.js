const aws = require('aws-sdk')
const express = require('express')
const app = express()
const path = require('path')
const body_parser = require('body-parser')


require('dotenv').config()
const port = 45454
aws.config.update ({
    "region": "ap-south-1",
    "accessKeyId": process.env.AWS_ACCESS_KEY,
    "secretAcesssKey": process.env.AWS_SECRET_ACCESS
    });
const db = new aws.DynamoDB();
const usr_table = "wf-users"
const s3 = new aws.S3()
const bucket_name = "wf-user-data"
var uid = 1

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.static(__dirname + "/public"))
app.use(express.static('public'))
app.use(body_parser.urlencoded({extended: true}));



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
    let params = {
        TableName: usr_table,
        Key: {
            user_id: user_id
        }
    }
    
    db.get(params, function (err, data) {
        if (err) {
            console.log(err);
            handleError(err, res);
        } else {
            handleSuccess(data.Item, res);
        }
     })
    })
    function handleError(err, res) {
        res.json({ 'message': 'server side error', statusCode: 500, error: 
        err })
    }
    
    function handleSuccess(data, res) {
        res.json({ message: 'success', statusCode: 200, data: data })
    }



app.listen(port,(err)=>{
    if(err) console.log(err)
    else console.log(`server running    -->  on ${port}`)
})