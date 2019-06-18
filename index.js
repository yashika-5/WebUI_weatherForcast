const aws = require('aws-sdk')
const express = require('express')
const app = express()
const path = require('path')
const body_parser = require('body-parser')
require('dotenv').config();
const port = 45454

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.static(__dirname + "/public"))
app.use(express.static('public'))
app.use(body_parser.urlencoded({extended: true}));


aws.config.update ({
    "region": "ap-south-1",
    "accessKeyId": process.env.AWS_ACCESS_KEY,
    "secretAcesssKey": process.env.AWS_SECRET_ACCESS
    });

const doc_client = new aws.DynamoDB.DocumentClient();
const usr_table = "wf-users"

app.get('/create', (req,res) => {
    res.render('signup')
} )

app.get('/fetch', (req, res) => {

    var user_id = "u2"
    let params = {
        TableName: usr_table,
        Key: {
            user_id: user_id
        }
    }
    
    doc_client.get(params, function (err, data) {
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