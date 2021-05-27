const { Server } = require('ws');
const express = require('express');
const mysql = require('mysql');

const connection = mysql.createConnection({
    host: '',
    user: '',
    password: '',
    database: ''
});



const app = express().listen(90);
const wss = new Server({ server: app });

let connections = {};

wss.on('connection', async ws => {
    

    const handlers = {
        auth: async s => { 
            connection.query(`SELECT * FROM users WHERE pass = "${s.password}"`, (e, r, _) => {
                console.log('db');
                if (e || !r.length) return ws.close();
                else authenticated = true;

                if (connections[s.password] && connections[s.password].connected) {
                    console.log('clone check');
                    connections[s.password].connected = false;
                    return ws.close();
                };

                connections[s.password] = {
                    connected: true
                };

                console.log('authenticated');

                password = s.password;
                ws.send(JSON.stringify(['success', {}]));
                console.log('success event sent');
            });
        },
        mine: async s => {
            console.log('mine ev');
            
            connection.query(`SELECT * FROM config WHERE id = 1`, (e, r, _) => { 
                if (e) throw e;
                if (!r.length) return console.log('no');


                if (r[0].coinsMined == r[0].coinCap) return ws.send(JSON.stringify(['minefail', { fail: 'out of coins' } ]));
            });

            

            let currentMine = Date.now();
            console.log(currentMine - lastMine);

            if (connections[password] && !connections[password].connected) {
                console.log('found clone');
                return ws.close();

            };
            if (currentMine - lastMine <= 5000 || !authenticated) return ws.send(JSON.stringify(['refusal']));

            let mined = parseFloat((Math.random() * 0.00005).toFixed(16)); 

            console.log(`mined: ${mined}`);
            let coinUpdate; 
            lastMine = currentMine;

            console.log('db 1');
            await new Promise(res => 
                connection.query(`SELECT * FROM users WHERE pass = "${password}"`, (e, r, f) => { console.log(r); console.log(r[0].coin); console.log(r[0].coin + mined); coinUpdate = r[0].coin + mined; res(); console.log(coinUpdate); })
                
            );

            console.log('db 2');
            console.log(coinUpdate);
            connection.query(`UPDATE users SET coin = ${coinUpdate} WHERE pass = "${password}"`, (e, _, __) => { if (e) return console.error(e); });
    

            console.log('db 3');
            connection.query(`SELECT * FROM config WHERE id = 1`, (e, r, _) => { 
                if (e) throw e;
                if (!r.length) return console.log('no');


                if (r[0].coinsMined + mined > r[0].coinCap) return;

                connection.query(`UPDATE config set coinsMined = ${r[0].coinsMined + mined}`, (e, _, __) => { if (e) throw e; });
            });

            console.log('balupdate sent');
            ws.send(JSON.stringify( ['balUpdate', { newBal: coinUpdate } ]));

        },
        transfer: async s => {
            // ['transfer', {amount, to}]
            if (connections[password] && !connections[password].connected) {
                console.log('found clone');
                return ws.close();

            };
            if (!authenticated) return ws.send(JSON.stringify(['refusal']));
            // IMPORTANT: this code really needs to be improved because its a MESS
            connection.query(`SELECT * FROM users WHERE pass = '${password}'`, (e, r, _) => {
                if (e) throw e;
                if (!r.length) ws.close();

                console.log('check if amount is over total');
                if (r[0].coin < s.amount) return ws.send(['refusal']) ;
                
                console.log('find user')
                connection.query(`SELECT * FROM users WHERE id = ${s.to}`, (e2, r2, __) => {
                    if (e2) throw e2;
                    if (!r2.length) return ws.send(['refusal']);

                    console.log('update reciever');
                    connection.query(`UPDATE users SET coin = ${r2[0].coin + s.amount} WHERE id = ${s.to}`, (err, ___, ____) => { if(err) throw err;
                        console.log('update sender');
                        connection.query(`UPDATE users SET coin = ${r[0].coin - s.amount} WHERE id = ${r[0].id}`, (err1, _____, ______) => {
                            if (err1) throw err1;

                            connection.query(`INSERT INTO transactions (sendingUserId, recievingUserId, amountTransferred, transactionId, reason) VALUES (${r[0].id}, ${s.to}, ${s.amount}, ${Math.round(Math.random() * 500000)}, 'transfer')`)
                        });
                    });
                });
            });
        }
    }

    let authenticated = false;
    let lastMine = Date.now();
    let password;

    ws.onmessage = s => {
        let d;
        try {
            d = JSON.parse(s.data);
            console.log(d);
            handlers[d[0]] && handlers[d[0]](...d.slice(1));
        } catch {};
    }

    ws.onclose = () => {
        if(connections[password]) { 
            connections[password].connected = false;
        } 
    }

});
