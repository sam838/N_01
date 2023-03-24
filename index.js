const express = require('express');
const app = express();
const mysql = require("mysql");
const fs= require("fs");
const jwt= require("jsonwebtoken");
const morgan=require('morgan');
const multer = require("multer");

app.use(express.json())
app.use(express.urlencoded({extended:true}));

const pool = mysql.createPool({
    host:"localhost",
    database:"tes_akhir_rabu_01",
    user:"root",
    password: "",
});

function getConnection(){
    return new Promise(function(resolve, reject){
        pool.getConnection(function (err,connection){
            if(err){
                reject(err);
            }else{
                resolve(connection);
            }
        });
    });
}

function executeQuery(conn,query){
    return new Promise(function(resolve,reject){
        conn.query(query,function(err,result){
            if(err){
                reject(err);
            }else{
                resolve(result);
            }
        });
    });
}

const storageProfile = multer.diskStorage({
    destination: function(req, file, callback) {
        callback(null, './public/uploads');
    },
    filename: async function(req, file, callback) {
        const extension = file.originalname.split('.')[file.originalname.split('.').length - 1];
        const conn = await getConnection();
        let nama_team = req.body.nama_team;
        let id = nama_team.substr(0,2).toUpperCase();
        let cekid = await executeQuery(conn, `select * from teams where id_team like '${id}%'`)
        let ctr = cekid.length + 1;
        let id_team = id+(ctr+"").padStart(3,"0");
        callback(null, (id_team + '.' + extension));
    }
});

function checkFileType(file,cb){
    const filetypes= /jpg|png/;
    const extname=filetypes.test(file.originalname.split('.')[file.originalname.split('.').length-1]);
    const mimetype=filetypes.test(file.mimetype);
    if(mimetype && extname){
        return cb(null,true);
    }else{
        cb(error = 'Error : Image Only!');
    }
}

const uploadphoto=multer({
    storage:storageProfile,
    fileFilter: function(req,file,cb){
        checkFileType(file,cb);
    }
});

const accessLogStream = fs.createWriteStream('./6703.log', {flags:'a'},);
let msg = '';
morgan.token('msg',(req,res)=>{return msg});
morgan.token('date', (req, res) => {
    let tgl = new Date();
    let dd = tgl.getDate();
    let mm = tgl.getMonth()+1;
    let yyyy = tgl.getFullYear();
    if(dd<10){
        dd = '0'+dd;
    }
    if(mm<10){
        mm = '0'+mm;
    }

    return `${dd}/${mm}/${yyyy} ${new Date().getHours()}:${new Date().getMinutes()}`;
});

morgan.token('msg',(req,res)=>{return msg});
let format = morgan(`Method: :method; URL: :url; Status: :status; Message: :msg; DateTime: :date;`,{stream:accessLogStream});
app.use(format);

function validateHhMm(inputField) {
    var isValid = /^([0-1]?[0-9]|2[0-4]):([0-5][0-9])(:[0-5][0-9])?$/.test(inputField.value);

    return isValid;
}
function cekUsername(inputtxt)
{
    var cek = /^(?=.*[0-9])(?=.*[a-zA-Z])([a-zA-Z0-9]+)$/
    if(inputtxt.match(cek))
    {
        return true;
    }
    else
    {
        return false;
    }
}
app.listen(3000,function () {
    console.log("listening on port 3000");
})
app.post('/api/users',async (req,res)=>{
    let conn = await getConnection();
    let username_user = req.body.username_user;
    let role;
    let password_user = req.body.password_user;
    let user = await executeQuery(conn,`select * from users where username_user = '${username_user}'`);
    let role_user = req.body.role_user;
    if (role_user != "U" && role_user != "u" && role_user != "A" && role_user != "a")
    {
        msg = 'role tidak sesuai';
        return res.status(400).send('role tidak sesuai')
    }
    else {
        let cek = cekUsername(username_user);
        if (cek){
            if (role_user == "U" || role_user == "u")
            {
                role = "User";
            }
            if (role_user == "A" || role_user == "a")
            {
                role = "Admin";
            }
            if (user.length>0)
            {
                msg = 'Username telah digunakan';
                return res.status(400).send('role tidak sesuai')
            }
            else
            {
                await executeQuery(conn, `insert into users values('${username_user}','${password_user}','${role_user}')`);
                conn.release();
                msg = "Berhasil menambahkan user baru";
                return res.status(201).send({
                    "username": username_user,
                    "role_user": role,
                })
            }
        }
        else
        {
            msg = "Format username tidak sesuai";
            return res.status(400).send("Format username tidak sesuai")
        }
    }
});

app.post('/api/generateApiKey', async function (req, res){
    const saltRounds = 10
    const salt = bcrypt.genSaltSync(saltRounds)
    const hashedSecret = bcrypt.hashSync(appSecret, salt)
    const data = {
      appSecret: hashedSecret,
      'createdAt': new Date(),
      // appName: body.appName,
      // type: body.type
      permissions: body.permissions
    }
    const returnData = {
      secret: appSecret,
      // appName: body.appName,
      // type: body.type
      permissions: body.permissions,
      description: body.description
    }
    // if(body.groupName && body.groupName !== ''){
    //   data.groupName = body.groupName
    //   returnData.groupName = body.groupName
    // }
    if(body.partnerCodes && body.partnerCodes.length > 0){
      data.partnerCodes = body.partnerCodes
      returnData.partnerCodes = body.partnerCodes
    }
    const writeResult = await this.almaKeys.insertOne(data)
    returnData.id = writeResult.insertedId
    return returnData
})
app.post('/api/users/login', async function(req,res){
    let conn = await getConnection();
    let id_user = req.body.username_user;
    let password_user = req.body.password_user;
    let user = await executeQuery(conn,`select * from users where username_user = '${id_user}'`);

    if(user.length == 0){
        msg = "Username tidak terdaftar";
        return res.status(404).send("Username tidak terdaftar");
    }

    if (password_user!=user[0].password_user){
        msg = "Password user salah";
        return res.status(400).send("Password user salah");
    }
    else {
        const token = jwt.sign({
            "username_user":id_user,
            "role_user":user[0].role_user
        }   ,"TASoA6703");
        msg = "Berhasil melakukan login";
        return res.status(201).send({
            "username_user" : id_user,
            "jwt_key" : token
        })
    }
});
app.post('/api/teams', uploadphoto.single("logo_team"), async function(req, res){
    let conn = await getConnection();
    let user;
    const token = req.header("x-auth-token");
    if(!token){
        msg = "unauthorized";
        return res.status(401).send("unauthorized");
    }
    try{
       user = jwt.verify(token,"TASoA6703");
    }catch(err){
        msg = "Token is invalid"
        return res.status(401).send("Token is invalid");
    }
    if(user.role_user == "A"){
        let directory;
        let nama_team = req.body.nama_team;
        let id = nama_team.substr(0,2).toUpperCase();
        let nama_stadion_team  = req.body.nama_stadion_team;
        let tahun_ditemukan_team = req.body.tahun_ditemukan_team ;
        let cekid = await executeQuery(conn, `select * from teams where id_team like '${id}%'`);
        let ctr = cekid.length + 1;
        let id_team = id+(ctr+"").padStart(3,"0");
        let regex = /^[0-9]*$/;
        if (tahun_ditemukan_team.match(regex))
        {
            directory = '/public/uploads/'+req.file.filename;
            await executeQuery(conn, `insert into teams values('${id_team}','${nama_team}','${nama_stadion_team}',${tahun_ditemukan_team},'${directory}')`);
        }
        else
        {
            msg = "Tahun tidak sesuai";
            return res.status(400).send("Tahun tidak sesuai");
        }
        conn.release();

        let response = {
            "id_team" : id_team,
            "nama_team" : nama_team,
            "nama_stadion_team" : nama_stadion_team,
            "tahun_ditemukan_team" : tahun_ditemukan_team,
            "logo_team" : directory
        }

        msg = "Berhasil Menambahkan Team";
        return res.status(201).json(response);
    }
    else
    {
        msg = "unauthorized";
        return res.status(401).send("unauthorized");
    }

});
app.get("/api/teams/:id_team",async function(req,res){
    const connection = await getConnection();
    let id_team =  req.params.id_team;
    let teams = await executeQuery(connection,`select * from teams where id_team = '${id_team}'`);
    if(teams.length == 0){
        msg = 'id team tidak terdaftar';
        return res.status(404).send("id team tidak terdaftar");
    }

    let matchesrespon = [];
    let matches_team1 = await executeQuery(connection,`select * from matches where team_match_1 = '${id_team}'`);
    if(matches_team1.length != 0){
        for (let i = 0; i < matches_team1.length; i++) {
            let namateam = await executeQuery(connection,`select * from teams where id_team = '${matches_team1[0].team_match_1}'`);

            matchesrespon.push({
                "id_match":matches_team1[i].id_match,
                "jam_match":matches_team1[i].jam_match,
                "versus":namateam[0].nama_team
            });
        }
    }
    let matches_team2 = await executeQuery(connection,`select * from matches where team_match_2 = '${id_team}'`);
    if(matches_team2.length != 0){
        for (let i = 0; i < matches_team2.length; i++) {
            let namateam = await executeQuery(connection,`select * from teams where id_team = '${matches_team2[0].matches_team2}'`);

            matchesrespon.push({
                "id_match":matches_team2[i].id_match,
                "jam_match":matches_team2[i].jam_match,
                "versus":namateam[0].nama_team
            });
        }
    }

    msg = 'berhasil mendapatkan data';
    connection.release();
    return res.status(201).send({
        "id_team": teams[0].id_team,
        "nama_team": teams[0].nama_team,
        "nama_stadion_team": teams[0].nama_stadion_team,
        "tahun_ditemukan_team": teams[0].tahun_ditemukan_team,
        "logo_team": teams[0].logo_team,
        "matches": matchesrespon,
    });
});