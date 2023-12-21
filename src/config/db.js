import mysql from 'mysql2';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password : process.env.DB_PASS,
    database : process.env.DB_NAME,
    debug: false
};

const pool = mysql.createPool(dbConfig);
const promisePool = pool.promise();

// promisePool.query('SELECT 1')
//   .then(() => {
//     console.log('Database connection successful');
//   })
//   .catch((err) => {
//     console.error('Database connection error', err);
//   });

export default promisePool;