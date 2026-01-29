/**
 * User Model
 * Defines the user schema for authentication and profile management
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            minlength: [2, 'Name must be at least 2 characters'],
            maxlength: [50, 'Name cannot exceed 50 characters'],
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [
                /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
                'Please provide a valid email',
            ],
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [6, 'Password must be at least 6 characters'],
            select: false, // Don't include password in queries by default
        },
        currency: {
            type: String,
            default: 'LKR',
            trim: true,
            maxlength: 5,
        },
        // Profile fields
        profilePhoto: {
            type: String,
            default: null,
            trim: true,
        },
        dateOfBirth: {
            type: Date,
            default: null,
        },
        gender: {
            type: String,
            enum: ['male', 'female', 'other', 'prefer_not_to_say', null],
            default: null,
        },
        phone: {
            type: String,
            default: null,
            trim: true,
            maxlength: 20,
        },
        bio: {
            type: String,
            default: null,
            trim: true,
            maxlength: 200,
        },
        country: {
            type: String,
            default: null,
            trim: true,
            maxlength: 100,
        },
    },
    {
        timestamps: true, // Adds createdAt and updatedAt
    }
);

// Note: email index is created automatically by unique: true

/**
 * Pre-save middleware to hash password
 */
userSchema.pre('save', async function () {
    // Only hash if password is modified
    if (!this.isModified('password')) {
        return;
    }

    // Generate salt and hash password
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Compare entered password with hashed password
 * @param {string} enteredPassword - Plain text password to compare
 * @returns {Promise<boolean>} - True if passwords match
 */
userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

/**
 * Remove sensitive data when converting to JSON
 */
userSchema.methods.toJSON = function () {
    const user = this.toObject();
    delete user.password;
    delete user.__v;
    return user;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
