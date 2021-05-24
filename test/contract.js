var _package = require('../');
var DGate = _package.DGate;
var assert = require('assert');
var ethers = require('ethers').ethers;

describe('D-Gate Contract', function() {
    const dg = new DGate( WALLET, _package.Chain.Testnet );

    it('should create DGate class', function(){
        assert.ok( Boolean(dg) );
    });

    it('should create a JsonRpc provider',function() {
        assert.ok( dg.provider instanceof ethers.providers.JsonRpcProvider );
    });

    it('should create a Contract instance',function() {
        assert.ok( dg.contract instanceof ethers.Contract );
    });

});