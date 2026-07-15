const express = require("express");
const cors = require("cors");
require("dotenv").config();


const employeeRoutes = require("./src/routes/employee.routes");
const attendanceRoutes = require("./src/routes/attendance.routes");
const syncRoutes = require("./src/routes/sync.routes");
const biotimeRoutes = require("./src/routes/biotime.routes");


const app = express();


app.use(cors());
app.use(express.json());


// APIs

app.use("/api/employees", employeeRoutes);

app.use("/api/attendance", attendanceRoutes);

app.use("/api/sync", syncRoutes);

app.use("/api/biotime", biotimeRoutes);



app.get("/",(req,res)=>{

    res.json({
        success:true,
        message:"Attendance Backend Running"
    });

});



const PORT = process.env.PORT || 5000;


app.listen(PORT,()=>{

    console.log(
        `Server running on port ${PORT}`
    );

});