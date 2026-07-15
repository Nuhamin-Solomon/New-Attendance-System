const pool = require("../config/db");

const {
    getEmployees,
    getAttendance
} = require("./biotime.service");



const syncEmployees = async () => {

    // BioTime returns { data: [...], success: true }
    const response = await getEmployees();

    const employees = response.data;

    if (!employees || !Array.isArray(employees)) {
        throw new Error("Invalid employee response from BioTime: " + JSON.stringify(response));
    }

    let synced = 0;

    for (const emp of employees) {

        await pool.query(

            `
            INSERT INTO employees
            (
                full_name,
                card_id,
                department
            )

            VALUES($1,$2,$3)

            ON CONFLICT(card_id)

            DO UPDATE SET

            full_name = EXCLUDED.full_name,

            department = EXCLUDED.department

            `,

            [
                `${emp.first_name} ${emp.last_name}`.trim(),
                emp.emp_code,
                emp.department || "Unknown"
            ]

        );

        synced++;

    }


    console.log(`Employees synced: ${synced}`);

    return synced;

};




const syncAttendance = async () => {


    const employees = await pool.query(

        `
        SELECT id, card_id
        FROM employees
        WHERE card_id IS NOT NULL
        `

    );


    let inserted = 0;



    for (const emp of employees.rows) {


        console.log(
            "Syncing attendance for:",
            emp.card_id
        );



        // BioTime returns { count: N, data: [...], success: true }
        let response;
        try {
            response = await getAttendance(emp.card_id);
        } catch (err) {
            console.error(`Failed to fetch attendance for ${emp.card_id}: ${err.message}`);
            continue;
        }


        const records = (response && response.data) ? response.data : [];



        for (const record of records) {

            if (!record.punch_time) continue;

            // Check for duplicate before inserting
            const exists = await pool.query(
                `SELECT id FROM attendance_logs WHERE employee_id=$1 AND scan_time=$2`,
                [emp.id, record.punch_time]
            );

            if (exists.rows.length > 0) continue;

            await pool.query(

                `
                INSERT INTO attendance_logs
                (
                    employee_id,
                    scan_time,
                    source,
                    raw_data
                )

                VALUES($1,$2,$3,$4)

                `,

                [
                    emp.id,
                    record.punch_time,
                    "biotime",
                    JSON.stringify(record)
                ]

            );

            inserted++;


        }


    }



    console.log(
        "Attendance inserted:",
        inserted
    );


    return inserted;


};




module.exports = {
    syncEmployees,
    syncAttendance
};