const app = require('express')();
const {DGate, Chain} = require('../');
// const { ethers } = require('ethers');

/**
 * Your wallet address.
 * You can create an account in MetaMask and copy it's address.
 * You ever don't need PRIVATE_KEY to interact with D-GATE, So do NOT store your private key anywhere in your code.
 */
const wallet = '';


/**
 * If you are testing your app, you can use testnet chain to test your app with fake BNB (faucet).
 * In the production mode that you want to receive REAL BNB from your clients, use Chain.Mainnet instead Chain.Testnet.
 */
const dg = new DGate( wallet, Chain.Testnet );

/**
 * invoices array holds invoices data on the RAM, this is just a practice .
 * For the real world you have to save invoices into your database.
 */
const invoices = [];


/**
 * This is a counter to generate a unique id (64bits uint) for every invoice.
 * You should generate and save unique ids for every invoice to identify it after user's payment.
 *
 */
let lastInvoiceId = 0;


/**
 * Every time a payment transaction occurs for your specified address (your wallet address),
 * this listener will call the callback function (At Real-Time).
 */
dg.onNewPayment(payment => {
    const invoice = invoices.find( inv => {
        /**
         * The comparision should include 'to' (Your wallet address), 'id', 'amount' (in BNB) for every payment invoice.
         * You can also use the static method of DGate class like : DGate.isSamePayment( a , b ).
         */
        if(
            inv.to.toLowerCase() === payment.to.toLowerCase()
            && inv.id === payment.id
            && inv.amount === payment.amount
        ){
            return true;
        }
    });
    if(invoice){
        // Updating the invoice.
        invoice.paid = true;
        invoice.time = payment.time;
        // Do something like sending a notification or update a database row.
    }

});

/**
 * List all of invoices.
 */
app.get('/invoices', async (req, res)=>{
    res.json( invoices );
});



/**
 * In this case we specified a fixed amount for every payment (Do not this on the real world app)
 */
const fixedAmount = 0.001;

/**
 * An API to create invoice with unique ids.
 */
app.get('/new-invoice', (req,res)=>{
    lastInvoiceId++;
    const id = lastInvoiceId;
    const invoice = {id, to : wallet, amount : fixedAmount, paid : false, time : 0};
    invoices.push(invoice);

    /**
     * dg.createPaymentUrl( id, amount ) generates a payment Url according the chain (Testnet/Mainnet) and your wallet address,
     * The payment link is encrypted to BASE-64 string that will be decrypted at gateway.
     * You can redirect your client to this link or everything that you want.
     */
    const paymentUrl = dg.createPaymentUrl( invoice.id, invoice.amount, 'http://localhost:3000/invoice' );

    res.redirect(paymentUrl);
});

/**
 * This will check the payment after client's payment and the redirection.
 */
app.get('/invoice', async (req,res)=>{

    // 'id' and 'address' will be passed by D-Gate.
    const id = parseInt(req.query.id);

    //const address = ethers.utils.isAddress(req.query.address) ? req.query.address : null;

    if(id < 0){
        // if not a valid id
        res.send('Bad request on query params');
        return false;
    }


    const invoice =  invoices.find( invoice => invoice.id === id );

    /// If the invoice not found.
    if(!invoice){
        await res.send('The invoice not found');
        return false;
    }

    // If the invoice is paid doesn't need to have been checked.
    if(invoice.paid){
        await res.json(invoice);
        return true;
    }

    let payment ;
    try{
        /**
         * Throttle calling dg.getPayment(id)  ( using express-rate-limit package ), it leaks the memory and causes performance issues.
         */
        payment = await dg.getPayment(id);
        const invoice = invoices.find( invoice => invoice.id === payment.id );

        /**
         *  Comparing 'id', 'amount', 'to' params using DGate.isSamePayment to make sure the payment is exact the same.
         *  And then updating the invoice's 'paid' and 'time' params.
         */
        if(invoice && DGate.isSamePayment(invoice, payment) ){
            invoice.paid = true;
            invoice.time = payment.time;
        }
        await res.json(invoice);
        return true;
    }catch(e){
        /// The Payment was not successful or isn't paid yet.

        /// re-generate the payment link
        const paymentLink = dg.createPaymentUrl( invoice.id, invoice.amount, 'http://localhost:3000/invoice' );
        await res.send(`The invoice is not paid. <a href="${paymentLink}">Payment link</a>`);
        return true;
    }
});

app.listen(3000, ()=>{
    console.log('Server is running on : http://localhost:3000');
})