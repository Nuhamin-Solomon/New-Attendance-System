const axios = require("axios");

const BIOTIME_URL = process.env.BIOTIME_URL;

async function getEmployees(){
    try {
        const response = await axios.get(
            `${BIOTIME_URL}/api/employees`
        );
        return response.data;
    } catch(error){
        console.error(
            "BioTime employee fetch error:",
            error.message
        );
        throw error;
    }
}

async function getAttendance(
    empCode,
    start,
    end
){
    try {
        const response = await axios.get(
            `${BIOTIME_URL}/api/attendance/${empCode}`,
            {
                params:{
                    start,
                    end
                }
            }
        );
        return response.data;
    }catch(error){
        console.error(
            "BioTime attendance fetch error:",
            error.message
        );
        throw error;
    }
}

module.exports = {
    getEmployees,
    getAttendance
};