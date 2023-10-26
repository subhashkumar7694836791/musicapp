var mongoose=require('mongoose');
var plm=require('passport-local-mongoose');
const userSchema=mongoose.Schema({
    username: String,
    email:String,
    contact:String,
    playList:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'playlist',
    }],
    likes:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'song',
    }],
    profileImage:{
type:String,
default:'/images/default.png'
    },
    isAdmin:{
        type:Boolean,
        default:false,
    },

})
userSchema.plugin(plm);
let userModel=mongoose.model('user',userSchema);
module.exports=userModel;