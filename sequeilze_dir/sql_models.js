const Sequelize = require("sequelize");

const sequelize = require("./sql_database");


const SentSMS = sequelize.define("sentSMS", {
    id: {
        type:Sequelize.INTEGER,
        primaryKey:true,
        allowNull:false,
        autoIncrement:true
    },

    surflineNumber: {
        type:Sequelize.STRING,
        allowNull: false,

    },

    smsType: {
        type:Sequelize.STRING,
        allowNull: true,

    },


    smsContent: {
        type:Sequelize.STRING,
        allowNull: false,

    },

    phoneContact: {
        type:Sequelize.STRING,
        allowNull: false,

    },
    MessageId: {
        type:Sequelize.STRING,
        allowNull: true,

    }




});





module.exports = SentSMS;

