const {
    syncEmployees,
    syncAttendance
} = require("../services/syncService");




exports.employees = async(req,res)=>{

    try{


        await syncEmployees();


        res.json({

            success:true,

            message:"Employees synchronized"

        });


    }catch(error){


        res.status(500).json({

            success:false,

            error:error.message

        });


    }

};





exports.attendance = async(req,res)=>{


    try{


        const result = await syncAttendance();



        res.json({

            success:true,

            message:"Attendance synchronized",

            inserted:result

        });



    }catch(error){


        res.status(500).json({

            success:false,

            error:error.message

        });


    }

};