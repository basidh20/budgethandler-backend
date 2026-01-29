/**
 * MongoDB Database Connection
 * Handles connection to MongoDB Atlas with error handling
 */

const mongoose = require('mongoose');
const { MONGODB_URI, NODE_ENV } = require('./env');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(MONGODB_URI, {
            // These options are no longer needed in Mongoose 6+, but kept for clarity
            // useNewUrlParser: true,
            // useUnifiedTopology: true,
        });

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error(`❌ MongoDB connection error: ${err}`);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB disconnected');
        });

        // Graceful shutdown
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            console.log('MongoDB connection closed due to app termination');
            process.exit(0);
        });

    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        // Exit process with failure in production
        if (NODE_ENV === 'production') {
            process.exit(1);
        }
    }
};

module.exports = connectDB;
