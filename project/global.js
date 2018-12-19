
var Global = {
    io : {},
    userSockets : {},
    storeUserSocket: function(session_id, tab_id,socket) {
    	if(!this.userSockets.hasOwnProperty(session_id))
    		this.userSockets[session_id] = {};
        this.userSockets[session_id][tab_id] = socket;
    },

    getUserSocket: function(session_id, tab_id){
        return this.userSockets[session_id][tab_id];
    }
};

module.exports = Global;