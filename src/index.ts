import * as ABI from './contract-abi.json';
import {ethers} from 'ethers';
import * as EventEmitter from "events";

export enum Chain{
    Testnet='Testnet',
    Mainnet='Mainnet',
}
export enum ChainID{
    BSC_Mainnet =  56,
    BSC_Testnet = 97,
}
export enum RPCUrl {
    BSC_Mainnet = 'https://bsc-dataseed.binance.org/',
    BSC_Testnet = 'https://data-seed-prebsc-1-s1.binance.org:8545/',
}

export const MainnetConfig : any = {
    url : RPCUrl.BSC_Mainnet,
    chain : {
        name : 'BSC Mainnet',
        chainId : ChainID.BSC_Mainnet,
    }
};

export const TestnetConfig : any = {
    url : RPCUrl.BSC_Testnet,
    chain : {
        name : 'BSC Testnet',
        chainId : ChainID.BSC_Testnet,
    }
};

export interface IPayment{
    id : number;
    from : string;
    to : string;
    amount : number;
    time : number;
    fee : number;
}

export enum CONTRACT_ADDRESS{
    Testnet='0x85334EEB36e318cF6eA4c0DBD21D51891095dc05',
    MainNet='0x85334EEB36e318cF6eA4c0DBD21D51891095dc05',
}

export enum GatewayUrl{
    BSC_Mainnet='https://bnb.d-gate.org/',
    BSC_Testnet='https://test-bnb.d-gate.org/',
}

export class DGateException extends Error{
    constructor(msg : string) {
        super(msg);
        if(msg && msg.length > 0)
            this.message = `DGATE internal error : ${msg}`;
        else
            this.message = 'DGATE internal unknown error';
    }
}

export class DGate {
    provider;
    private account : string = null;
    private gateway : string;
    contract;
    events : EventEmitter;

    constructor(walletAddress : string, chain : Chain = Chain.Mainnet, contractAddress? : string){
        this.events = new EventEmitter();

        if(!contractAddress){
            switch (chain) {
                case Chain.Mainnet:
                    contractAddress = CONTRACT_ADDRESS.MainNet;
                    this.gateway = GatewayUrl.BSC_Mainnet;
                    break;
                case Chain.Testnet:
                    contractAddress = CONTRACT_ADDRESS.Testnet;
                    this.gateway = GatewayUrl.BSC_Testnet;
                    break;
            }
        }
        if(ethers.utils.isAddress(walletAddress))
            this.account = walletAddress;
        else throw new DGateException(`Wallet's address is not a valid blockchain address`);

        switch (chain) {
            case Chain.Mainnet:
                this.provider = new ethers.providers.JsonRpcProvider(MainnetConfig.url, MainnetConfig.chain);
                break;
            case Chain.Testnet:
                this.provider = new ethers.providers.JsonRpcProvider(TestnetConfig.url, TestnetConfig.chain);
                break;
        }

        if(ethers.utils.isAddress(contractAddress))
            this.contract = new ethers.Contract(contractAddress, ABI, this.provider);
        else throw new DGateException(`Contract's address is not a valid blockchain address`);

        this.contract.on("NewPayment", (payment : IPayment)=>{
            payment = DGate.parseRawPayment(payment);
            if(payment.to.toLowerCase() == this.account.toLowerCase()){
                this.events.emit('NewPayment', payment);
            }
        });
    }
    
    async getPayment(id : number) : Promise<IPayment>{
        if(id < 0)
            throw new DGateException(`error on => dgate.getPayment(id : number) method call, (id) should be an unsigned-int 64bit format`);
        const raw = await this.contract.findPayment(this.account, id);
        if(!raw || !raw.hasOwnProperty('id') || raw.id.toNumber() != id)
            throw new DGateException(`payment id of "${id}" not found`);
        return DGate.parseRawPayment(raw);
    }

    async getAllPayments() : Promise<IPayment[]>{
        let payments = await this.contract.getPayments(this.account);
        payments = payments.map( p => DGate.parseRawPayment(p) );
        return payments;
    }

    static parseRawPayment(raw) : IPayment {
        return({
            id : raw.id.toNumber(),
            from : raw.from,
            to : raw.to,
            amount : parseFloat(ethers.utils.formatEther(raw.amount)),
            fee : parseFloat(ethers.utils.formatEther(raw.fee)),
            time : raw.time.toNumber(),
        });
    }

    setAccount(address : string){
        if(!ethers.utils.isAddress(address))
            throw new DGateException(`error on => dgate.setAccount(address : string) method call, (address) should be a valid address`);
        this.account = address;
    }

    onNewPayment(callback : (payment : IPayment)=>void){
        this.events.on('NewPayment', callback);
    }

    static isSamePayment(a : IPayment | any, b : IPayment | any) : boolean{
        if(!a || !b || !a.to || !b.to)
            return false;
        return (
            a.id == b.id
            && a.amount == b.amount
            && a.to.toLowerCase() == b.to.toLowerCase()
        )
    }

    /**
     * This method uses Base-64 encoding to encode the parameters that the payment gateway needs to identify the payment.
     * Encoding parameters prevents unintentional modifying parameters by client, although the referrer website will verify the payment
     * according block-chain's data by id, amount, to(account address) using DGate.isSamePayment() method not what user put into the url payment.
     * So this is secure to use this and there's no bug here!
     */
    createPaymentUrl(
        // A unique id (uint - 64bits), for every checkout invoice.
        id : number,
        // amount in BNB
        amount : number,
        // The redirect url that user will be redirected to it, after the payment.
        redirect? : string,
    ){
        const stringData = JSON.stringify({id, address : this.account, amount, redirect });
        const bufferData = Buffer.alloc(stringData.length, stringData);
        return `${this.gateway}?payment=${bufferData.toString('base64')}`;
    }
}