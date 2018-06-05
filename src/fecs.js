/**
 * @file: fecs.js
 * @author: yanglei07
 * @description ..
 * @create data: 2018-05-31 15:49:22
 * @last modified by: yanglei07
 * @last modified time: 2018-06-05 12:01:13
 */

/* global  */

/* eslint-disable fecs-camelcase */
/* eslint-enable fecs-camelcase */
'use strict';
const Readable = require('stream').Readable;

const File = require('vinyl');

const config = require('./config.js');

const fecs = (() => {
    let fecsLib = null;
    try {
        fecsLib = require('fecs');
    }
    catch (ex) {
        fecsLib = null;
    }
    return fecsLib;
})();


function createCodeStream(code = '', filePath = '') {

    let type = filePath.split('.').pop();

    let buf = Buffer.from(code);
    let file = new File({
        contents: buf,
        path: filePath || 'current-file.' + type,
        stat: {
            size: buf.length
        }
    });
    let stream = new Readable();
    stream._read = function () {
        this.emit('data', file);
        this.push(null);
    };
    return stream;
}

function check(code = '', filePath = '') {

    let fileStream = createCodeStream(code, filePath);
    let isES6 = isUseES6(code, filePath);

    let p = new Promise((r, j) => {
        fecs.check({
            es: isES6 ? 6 : 5,
            lookup: true,
            stream: fileStream,
            reporter: config.en ? '' : 'baidu',
            level: config.level
        }, (success, json) => {

            let errors = (json[0] || {}).errors || [];
            r(errors);
        });
    });

    return p;
}

function format(code = '', filePath = '') {

    let fileStream = createCodeStream(code, filePath);
    let isES6 = isUseES6(code, filePath);

    let p = new Promise((r, j) => {

        let bufData = [];
        fecs.format({
            es: isES6 ? 6 : 5, // 好像  此项配置对 format 无效？
            lookup: true,
            stream: fileStream,
            reporter: config.en ? '' : 'baidu',
            level: config.level
        }).on('data', file => {
            bufData = bufData.concat(file.contents);
        }).on('end', () => {
            r(bufData.toString('utf8'));
        });
    });

    return p;
}

/**
 * 通过正则简单判断是否是 es6 语法， 只能覆盖一部分场景， 无法 100% 识别， 但一般基本够用
 *
 * @param {string} code 代码字符串
 * @param {string} filePath 代码文件路径
 * @return {boolean} 是 es 语法则返回 true
 */
function isUseES6(code, filePath) {

    // 非 .js 文件不会使用此项配置， 直接返回 false
    if (!/\.js$/.test(filePath)) {
        return false;
    }

    // 清除字符串和注释
    // 正则参考的这里： https://github.com/fex-team/fis3/blob/master/lib/compile.js#L322
    code = code

        // 清除字符串
        .replace(/'(?:[^\\'\n\r\f]|\\[\s\S])*'/g, '\'\'') // 清除单引号字符串
        .replace(/"(?:[^\\"\n\r\f]|\\[\s\S])*"/g, '\'\'') // 清除双引号字符串
        .replace(/`(?:[^\\`\n\r\f]|\\[\s\S])*`/g, '\'\'') // 清除反引号模板字符串

        // 清除注释
        .replace(/\/\/[^\r\n\f]+/g, '') // 清除单行注释
        .replace(/\/\*[\s\S]+?(?:\*\/|$)/g, '') // 清除多行注释

        // 清除正则表达式
        .replace(/\/(?:[^\\/\n\r\f]|\\[\s\S])+\/[gimuy]*/g, '/x/');

    //  匹配 ES6 语法， 估计一堆 bug, 凑合用
    let regList = [
        /(^|[^.])\b(let|const|import|export|of|class|async|yield|await)\b([^.]|$)/, // 部分关键字

        /[\]}]\s*=/, // 解构： var {x,y} = obj; var [x,y] = arr;
        /=>|\.\.\./, // 箭头函数、解构
        /(^|[^.])function[^(]*\(.+=.+\)/, // 函数参数默认值
        /(^|[^.])function[^(]*\(.*[{}[\]].*\)/, // 函数参数解构
        /(^|[^.])function\s*\*/ // generator 语法
    ];

    return regList.some(reg => reg.test(code));
}

exports.check = check;
exports.format = format;

// 是否成功引入 fecs
exports.imported = !!fecs;
