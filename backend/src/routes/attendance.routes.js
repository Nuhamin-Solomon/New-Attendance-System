const express = require("express");

const router = express.Router();

const pool = require("../config/db");



router.get("/",async(req,res)=>{


try{


const result = await pool.query(`

SELECT

attendance_logs.id,

employees.full_name,

employees.department,

attendance_logs.scan_time,

attendance_logs.source


FROM attendance_logs


JOIN employees

ON employees.id = attendance_logs.employee_id


ORDER BY attendance_logs.scan_time DESC


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