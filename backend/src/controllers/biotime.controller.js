const bioTime = require("../services/biotime.service");


exports.employees = async (req,res)=>{

    try {

        const data = await bioTime.getEmployees();

        res.json(data);

    } catch(error){

        res.status(500).json({
            success:false,
            error:error.message
        });

    }

};


exports.attendance = async(req,res)=>{

    try{

        const data = await bioTime.getAttendance(
            req.params.empCode,
            req.query.start,
            req.query.end
        );


        res.json(data);


    }catch(error){

        res.status(500).json({
            success:false,
            error:error.message
        });

    }

};