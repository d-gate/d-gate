
# D-Gate JS
[D-Gate](https://d-gate.org) JS is an application programming interface (API) package to implement your 
decentralized payment gateway over NodeJS platform.

This package uses [Ethers.JS](https://docs.ethers.io/v5/) to interact with a deployed smart contract on the blockchain (BSC) by including the contract ABI (/src/contract-abi.json).

## D-Gate Platform
[D-Gate](https://d-gate.org) is a payment platform funded on the Binance Smart Chain .
It allows websites and applications to implement their own payment gateways.
Today D-Gate only supports BNB for payments, at a nearby future D-Gate will support more tokens on Binance Smart Chain like USDT, DAI and etc...

Website : [https://d-gate.org](https://d-gate.org)

WhitePaper : [https://d-gate.org/whitepaper](https://d-gate.org/whitepaper)

Issues : [https://github.com/d-gate/d-gate/issues](https://github.com/d-gate/d-gate/issues)

Source Code : [https://github.com/d-gate/d-gate](https://github.com/d-gate/d-gate)


## Prerequisites
It's needed to know some basics of [Ethereum](https://ethereum.org/) and blockchain to get started developing.

Once you've started developing your crypto payment method, so you need a wallet to receive payments on your wallet.

We offer [MetaMask](https://metamask.io/download) browser extension to create your own wallet and get started to developing.

MetaMask keeps safe your private keys and manage your accounts on the blockchain.
After installing MetaMask you need to get your wallet address (****** NOT Private key ******) from MetaMask.

An address on Ethereum network or Binance Smart Chain is a hexa-decimal hash that is your identity on the blockchain.

Example Address (Do not use this address in your case) : **0x8C991f0afe6451442dFA8F28b6Bbf71fd650b22B**

## Installation

Use the Node package manager (NPM) to install the package:

`npm i @dgate/bsc --save`

## Simple payment app (with ExpressJS)
In this case we try to implement a simple NodeJS & Express application that helps you to figure out how actually DGate package works.

```node
const app = require('express')();
const {DGate, Chain} = require('@dgate/bsc');

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
        // Updating the invoice
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
const fixedAmount = 0.05;

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
```

# API
### IPayment (Payment Interface | Typescript)
In the blockchain data will store with a structured format like this : 
```
struct Payment{
    uint64 id;
    address from;
    address to;
    uint256 amount; /// Amount in wei ( 1 BNB == 10^18 wei)
    uint256 time;
    uint256 fee; /// Fee in wei 
}
```
If you are using `@dgate/bsc` package, it will automatically convert it to a standard format by an static method called `DGate.parseRawPayment(payment)` : 
``` typescript
interface IPayment{
    id : number; /// An unique id, Unsigned integer (64 bits)
    from : string; /// Payer's address
    to : string; /// Payee's address
    amount : number; /// amount of payment in BNB (float)
    time : number; /// Unix timestamp (UTC) in seconds (int)
    fee : number; /// amount of fee substracted of main amount in BNB (float)
}
```

### Chain (Enum)
``` typescript
enum Chain{
    Testnet='Testnet',
    Mainnet='Mainnet',
}
```

### ChainID (Enum)
``` typescript
enum ChainID{
    BSC_Mainnet =  56,
    BSC_Testnet = 97,
}
```
### CONTRACT_ADDRESS (Enum)
``` typescript
enum CONTRACT_ADDRESS{
    Testnet='0x85334EEB36e318cF6eA4c0DBD21D51891095dc05',
    MainNet='0x85334EEB36e318cF6eA4c0DBD21D51891095dc05',
}
```

## Methods

### Constructor - new DGate( walletAddress : string, chain : Chain = Chain.Mainnet, contractAddress? : string)
Creates an instance of DGate class, could be used to interact with your gateway.
<br/>
<br/>

### async getPayment( id : number ) : Promise<IPayment\>
Fetches a specified payment by its id from the blockchain.
If the payment not found on the blockchain (or not paid) it throws an error.
<br/>
<br/>

### async getAllPayments() : Promise<IPayment[]>
Returns a Promise that will resolve an array of your payments or rejects if there were an error.
<br/>
<br/>

### setAccount( address : string ) : void 
Sets your recipient wallet address to a new address.
It also will throw an error if the address is invalid.
<br/>
<br/>

### createPaymentUrl( id : number, amount : number, redirect? : string )
This method is an important method that creates a payment url according the chain (At Real-Time, it doesn't need to be online) and returns a link (string), you can redirect your client to the link to pay the invoice.
<br/>
It uses BASE-64 encryption to create an encoded link, this doesn't guarantee to prevent user from modifying the amount or id but the most important security tip is that you always identify the payment on the blockchain according its "id", "amount", "to"(address) and if the user modify this encrypted data (intentionally) the user will lose his/her funds, not you. 

## Static Methods
### static isSamePayment(a : IPayment | any, b : IPayment | any) : boolean
A static method that compares tow payments (id, amount, to), to make sure those are the same payments.

### static parseRawPayment( rawPayment ) : IPayment 
It parses the structured data formatted in BigNumber (wei) to a float value formatted in BNB (IPayment).
<br/>
<br/>


## class DGateException extends Error {}
It's used to throw exceptions in some cases, you can use a try/catch syntax to handle the errors those DGate class will throw.