const express = require("express");
const router = express.Router();

const pool = require("../config/db");



router.get("/",async(req,res)=>{


try{


const result = await pool.query(`

SELECT

id,
full_name,
card_id,
department

FROM employees

ORDER BY id

`);



res.json(result.rows);



}catch(error){


console.log(error);


res.status(500).json({

error:error.message

});


}


});



module.exports = router;