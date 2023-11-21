var express = require('express');
var router = express.Router();
var users=require('../models/userModel');
var songModel=require('../models/songModel');
var playlistModel=require('../models/playlistModel')
var passport= require('passport');
var LocalStrategy = require('passport-local');
passport.use(new LocalStrategy(users.authenticate()));
/* GET home page. */
var id3=require('node-id3');
var mongoose=require('mongoose');
var multer=require('multer');
var {Readable}=require('stream');
var crypto=require('crypto');
const { log } = require('console');
mongoose.connect('mongodb://0.0.0.0/dusraspt').then(function(){
  console.log('mongodb successfully connected');
}).catch(function(err){
  console.log(err);
})

const conn = mongoose.connection

var gfsBucket, gfsBucketPoster
conn.once('open', () => {
  gfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: 'audio'
  })
  gfsBucketPoster = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: 'poster'
  })
})
router.get('/',isLoggedIn,async function(req, res, next) {
  const currentUser = await users.findOne({
    _id: req.user._id
  }).populate('playList').populate({
    path: 'playList',
    populate: {
      path: 'songs',
      model: 'song'
    }
  })
  res.render('index', {currentUser});
});
// authenticated code

router.post('/register',async (req,res,next)=>{
var newUser={
//user data here
username:req.body.username,
email:req.body.email,
//user data here
};
users
.register(newUser, req.body.password)
.then((result)=>{
passport.authenticate('local')(req,res,async()=>{
//description after register
const songs = await songModel.find()
        const defaultPlayList = await playlistModel.create({
          name: req.body.username,
          owner: req.user._id,
          songs: songs.map(song => song._id)
        })
        const newUser = await users.findOne({
          _id:req.user.id
        })

        newUser.playList.push((defaultPlayList._id))

        await newUser.save()

res.redirect('/')
})
})
.catch((error)=>{
res.send(error)
});
});
router.get('/auth',function(req, res, next){
  res.render('register')
})
const storage = multer.memoryStorage()
const upload = multer({ storage: storage })
router.post('/uploadSong',isLoggedIn,isAdmin,upload.array('song'),async function(req, res, next){
    // console.log(req.file);
    await Promise.all(req.files.map(async file=> {
      
      console.log(id3.read(file.buffer));
      var randomName=crypto.randomBytes(20).toString('hex');
      var songData=id3.read(file.buffer);
      Readable.from(file.buffer).pipe(gfsBucket.openUploadStream(randomName))
      Readable.from(songData.image.imageBuffer).pipe(gfsBucketPoster.openUploadStream(randomName + `poster`))
      
      await songModel.create({
        title:songData.title,
        artist:songData.artist,
        album:songData.album,
        size:file.size,
        poster:randomName + `poster`,
        fileName:randomName
      })
    }))
    res.send('file uploaded')
});
router.get('/uploadMusic',isLoggedIn,isAdmin,function(req, res,next){
  res.render('uploadMusic')
});

router.get('/poster/:posterName',function(req,res,next){
  gfsBucketPoster.openDownloadStreamByName(req.params.posterName).pipe(res);
});

router.post(
'/login',
passport.authenticate('local',{
successRedirect:'/',
failureRedirect:'/auth',
}),
(req,res,next) => {}
);

router.get('/logout',function(res,res,next){
if(req.isAuthenticated())
req.logout(function(err){
if(err) res.send(err)
else res.redirect('/')
});

else{
res.redirect('/')
}
});


function isLoggedIn(req, res,next) {
if (req.isAuthenticated()) {
next();
} else {
res.redirect('/auth')
}
}

function isAdmin(req, res, next) {
  if (req.user.isAdmin) return next()
  else return res.redirect('/')
}
// authenticated code
// router.get('/stream',(req, res, next) => {
//   gfsBucket.openDownloadStreamByName('31a3ae7866a44dbb3359d86ca31271c960c98584').pipe(res);
// })

router.get('/stream/:musicName',async (req, res, next) => {
  const currentSong=await songModel.findOne({
    fileName:req.params.musicName,
  })
 const stream= gfsBucket.openDownloadStreamByName(req.params.musicName)
 res.set('Content-Type', 'audio/mpeg')
 res.set('Content-Length',currentSong.size + 1)
 res.set('Content-Range', `bytes 0-${currentSong.size - 1}/${currentSong.size}`)
 res.set('Content-Ranges','byte')
 res.status(206)
 stream.pipe(res)
});
router.get('/profile',isLoggedIn , (req,res,next)=>{
  
  songModel.findOne({
    title:req.body.title,
artist:req.body.artist,
album:req.body.album,
  })
  
  
  .then(function(proData){
    users.findOne()
    .populate('playList')
    .then(function(userData){

      res.render('profile',{proData,userData})
    })
  })
});
router.get('/search',function(req,res,next){
  res.render('search')
})
router.post('/search',async function(req,res,next){
  // console.log(req.body);
  const searchMusic = await songModel.find({
    title:{$regex: req.body.search}
  })
  // console.log(searchMusic);
  res.json({
    songs:searchMusic
  })
})
router.get('/reset',function(req,res,next){
  res.render('reset');
})
router.post('/reset',async function(req,res,next) {
  try {
    await req.user.changePassword(
      req.body.oldpassword,
      req.body.newpassword
    );
    req.user.save()
    res.redirect('/auth')
  } catch (error) {
    console.log(error);
  }
});
module.exports = router;
