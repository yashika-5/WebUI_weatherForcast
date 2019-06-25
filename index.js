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
const https = require('https')
const base64 = require('base-64')
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
const TOKEN = process.env.DATABRICKS_TOKEN

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
            colname = JSON.stringify(content.toString().split('\n')[0].split(',') )
            res.render('select_target', {colname : colname})
            var param_to_delete_previous = {
                Bucket: bucket_name,
                Key: `${req.session.passport.user}/`,
                Body: "no matter"
            }
            s3.deleteObject(param_to_delete_previous, (dp_err, dp_data) => {
                if (dp_data) {
                    console.log("File deleted successfully");
                }
                else {
                    console.log("Check if you have sufficient permissions : "+err);
                }
            })
            var param_to_upload_csv = {
                Bucket: bucket_name,
                Key: `${req.session.passport.user}/data.csv`,
                Body: content.toString()
            }
            s3.upload(param_to_upload_csv, (s3err, content) => {
                console.log(`File uploaded successfully at ${content.Location}`)
            })
            fs.unlinkSync('tempupload/datacsv-'+req.session.passport.user)
        })
        // console.log(data_for_area_graph)
       
        
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
app.get('/wait', (req,res) => {
    if(req.isAuthenticated()) {
        res.render('wait10')
    }
    else {
        res.redirect('/login')
    }
})

app.get('/results', (req, res) => {
    if(req.isAuthenticated()){
        param_to_get_acc = {
            Bucket: bucket_name,
            Key: `${req.session.passport.user}/acc.txt`,
        }
        s3.getObject(param_to_get_acc, (err_s3_acc, data_acc) => {
            if(err_s3_acc) {
                console.log(err_s3_acc)
            }
            else {
                eff = data_acc.Body.toString()
                res.render('results', {eff: eff})
            }
        })
    
    }
    else{
        res.redirect('/login')
    }
})

// app.get('/areachart', (req,res) => {
//     res.render('areachart')
// })
app.post('/final_submit', (req, res) => {
    // console.log("check here----",req.body)
    // first element in the list will be target column 
    if(req.isAuthenticated()) {
    var col_num = [req.body.targetcol]
    for(var key in req.body) {
        if(req.body[key] == 'on') {
            col_num.push(key)
        }
        console.log(key, req.body[key])
    }
    console.log(col_num.toString())
    param_to_save_colnum={
        Bucket: bucket_name,
        Key: `${req.session.passport.user}/col_num.csv`,
        Body: col_num.toString()
    }
    s3.upload(param_to_save_colnum, (err, data) => {
        if(err) {
            console.log(err)
        }
        else {
            console.log('upload done col num')
        }
    })
    var data = JSON.stringify({
        "name": `${req.session.passport.user}_job`,
      "new_cluster": {
        "spark_version": "5.2.x-scala2.11",
        "node_type_id": "i3.xlarge",
        "num_workers": 8
    
      },
      "spark_python_task": {
        
        "python_file": "dbfs:/FileStore/tables/drvcode.py",
        "parameters": [
            req.session.passport.user
      ]
      }
    })
    const options_to_create_job = {
      hostname: "dbc-d80ba214-2140.cloud.databricks.com",
      port: 443,
      path: '/api/2.0/jobs/create',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': "Basic " + base64.encode("token:" + TOKEN)
      }
    }
    
    const req_to_create = https.request(options_to_create_job, (res_for_create) => {
      //console.log(`statusCode: ${res.statusCode}`)
    
      res_for_create.on('data', (d) => {
      process.stdout.write(d)
      data = d.toString()
      const options_to_run_job = {
        hostname: "dbc-d80ba214-2140.cloud.databricks.com",
        port: 443,
        path: '/api/2.0/jobs/run-now',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': "Basic " + base64.encode("token:" + TOKEN)
        }
      }
      const req_to_run = https.request(options_to_run_job, (res_for_run) => {
        res_for_run.on('data', (d) => {
          process.stdout.write(d)
        })
      })
      req_to_run.on('error', (error) => {
        console.error(error)
      })
      
      req_to_run.write(data)
      
      
      req_to_run.end()
      
    
      })
    })
    
    req_to_create.on('error', (error) => {
      console.error(error)
    })
    
    req_to_create.write(data)
    
    
    req_to_create.end()

    res.render('wait10') 
}
else {
    req.redirect('/login')
}
}) 


// app.get('*', (req,res) => {
//     res.redirect('/')
// })

app.listen(port,(err)=>{
    if(err) console.log(err)
    else console.log(`server running    -->  on ${port}`)
})