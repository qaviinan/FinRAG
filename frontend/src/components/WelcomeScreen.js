import React from "react";

const WelcomeScreen = ({ onClickSample }) => {
    return (
        <div className="welcome-screen text-center p-4">
            <h1 className="text-8xl text-gray-700 font-bold mb-4">SAY HELLO TO FINRAG</h1>
            <p className="text-xl text-gray-700 mb-4">
                An AI agent with access to curated trading knowledge written by expert traders.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button 
                    className="sample-query border-2 border-slate-400 hover:bg-blue-500 hover:text-white text-gray-600 font-bold py-4 px-4 rounded"
                    onClick={() => onClickSample("What are the ways in which I can use carry to generate profits from futures trading?")}
                >
                    What are the ways in which I can use carry to generate profits from futures trading?
                </button>
                <button 
                    className="sample-query border-2 border-slate-400 hover:bg-blue-500 hover:text-white text-gray-600 font-bold py-4 px-4 rounded"
                    onClick={() => onClickSample("How can I use PCA to decompose a market into uncorrelated factors? Give a real example")}
                >
                    How can I use PCA to decompose a market into uncorrelated factors? Give a real example
                </button>
                <button 
                    className="sample-query border-2 border-slate-400 hover:bg-blue-500 hover:text-white text-gray-600 font-bold py-4 px-4 rounded"
                    onClick={() => onClickSample("Outlne how I can build a yield curve model using PCA")}
                >
                    Outlne how I can build a yield curve model using PCA
                </button>
            </div>
        </div>
    );
  };

export default WelcomeScreen;