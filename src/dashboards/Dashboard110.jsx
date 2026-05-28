import { useState, useCallback, useMemo, useEffect } from 'react';
import { parse110ExcelFile } from '../utils/parse110Excel';
import { mergeMonthlyData } from '../utils/storage';
import { loadDashboard, saveDashboard } from '../utils/firebase';

// ─── DEMO DATA ────────────────────────────────────────────────────────────────
const DEMO = {
  period: '26년 03월',
  total: {
    name: 'ETC 병원본부', hosp_count: 109,
    grade_final: 'Cp', grade_quality: 'B', grade_quant: 'Cp',
    total_target: 749,
    mbo_rate: 0.2094, mbo_eval: 'B',
    result_sangjeong_rate: 0.6362, result_eval: 'B',
    result_pass_rate: 0.7986, result_pass_eval: 'B',
    result_coding_rate: 0.8310,
    mbo_vs: 0.9691, mbo_vs_eval: 'B',
    base_vs: 0.8852, base_vs_eval: 'C',
  },
  divisions: [
    { name: '서울1사업부', manager: '남궁민', hosp_count: 33,
      grade_final: 'Cp', grade_quality: 'B', grade_quant: 'C', total_target: 192,
      mbo_rate: 0.2101, mbo_eval: 'B',
      result_sangjeong_rate: 0.7032, result_eval: 'A',
      result_pass_rate: 0.7887, result_pass_eval: 'B',
      result_coding_rate: 0.8721,
      mbo_vs: 0.9850, mbo_vs_eval: 'B', base_vs: 0.8950, base_vs_eval: 'B' },
    { name: '서울2사업부', manager: '정진명', hosp_count: 31,
      grade_final: 'Cp', grade_quality: 'B', grade_quant: 'Cp', total_target: 228,
      mbo_rate: 0.2012, mbo_eval: 'A',
      result_sangjeong_rate: 0.6042, result_eval: 'B',
      result_pass_rate: 0.7069, result_pass_eval: 'C',
      result_coding_rate: 0.8293,
      mbo_vs: 0.9620, mbo_vs_eval: 'C', base_vs: 0.8720, base_vs_eval: 'C' },
    { name: '지방1사업부', manager: '임병옥', hosp_count: 27,
      grade_final: 'Cp', grade_quality: 'B', grade_quant: 'Cp', total_target: 205,
      mbo_rate: 0.2230, mbo_eval: 'S',
      result_sangjeong_rate: 0.5625, result_eval: 'B',
      result_pass_rate: 0.8519, result_pass_eval: 'A',
      result_coding_rate: 0.8370,
      mbo_vs: 0.9782, mbo_vs_eval: 'B', base_vs: 0.9020, base_vs_eval: 'A' },
    { name: '지방2사업부', manager: '노희창', hosp_count: 18,
      grade_final: 'B', grade_quality: 'B', grade_quant: 'B', total_target: 124,
      mbo_rate: 0.2380, mbo_eval: 'B',
      result_sangjeong_rate: 0.7290, result_eval: 'A',
      result_pass_rate: 0.8462, result_pass_eval: 'A',
      result_coding_rate: 0.8932,
      mbo_vs: 0.9970, mbo_vs_eval: 'A', base_vs: 0.9380, base_vs_eval: 'A' },
  ],
  offices: [
    { division:'서울1사업부', office:'병원강원사무소',  manager:'김병준', hosp_count:4,  grade_final:'Cp', grade_quality:'C', grade_quant:'B',  total_target:26,  mbo_rate:0.2010,mbo_eval:'C',  result_sangjeong_rate:0.5000,result_eval:'C',  result_pass_rate:0.9231,result_pass_eval:'A', result_coding_rate:0.6154, mbo_vs:0.9230,mbo_vs_eval:'C', base_vs:0.8500,base_vs_eval:'C' },
    { division:'서울1사업부', office:'병원경인사무소',  manager:'정창민', hosp_count:4,  grade_final:'Cp', grade_quality:'B', grade_quant:'C',  total_target:40,  mbo_rate:0.1950,mbo_eval:'B',  result_sangjeong_rate:0.3500,result_eval:'C',  result_pass_rate:1.0,   result_pass_eval:'S', result_coding_rate:0.9286, mbo_vs:0.9910,mbo_vs_eval:'A', base_vs:0.9100,base_vs_eval:'B' },
    { division:'서울1사업부', office:'병원서울1사무소', manager:'박용식', hosp_count:2,  grade_final:'B',  grade_quality:'A', grade_quant:'B',  total_target:10,  mbo_rate:0.2800,mbo_eval:'A',  result_sangjeong_rate:1.0000,result_eval:'S',  result_pass_rate:1.0,   result_pass_eval:'S', result_coding_rate:1.0,    mbo_vs:1.0020,mbo_vs_eval:'A', base_vs:0.9850,base_vs_eval:'A' },
    { division:'서울1사업부', office:'병원서울2사무소', manager:'박효빈', hosp_count:5,  grade_final:'B',  grade_quality:'B', grade_quant:'B',  total_target:12,  mbo_rate:0.2100,mbo_eval:'B',  result_sangjeong_rate:0.6667,result_eval:'B',  result_pass_rate:1.0,   result_pass_eval:'S', result_coding_rate:0.8750, mbo_vs:0.9870,mbo_vs_eval:'B', base_vs:0.9200,base_vs_eval:'B' },
    { division:'서울1사업부', office:'병원서울3사무소', manager:'박천광', hosp_count:5,  grade_final:'Cp', grade_quality:'C', grade_quant:'Cp', total_target:26,  mbo_rate:0.2250,mbo_eval:'B',  result_sangjeong_rate:0.6154,result_eval:'C',  result_pass_rate:0.8125,result_pass_eval:'B', result_coding_rate:0.7692, mbo_vs:0.9540,mbo_vs_eval:'C', base_vs:0.8800,base_vs_eval:'C' },
    { division:'서울1사업부', office:'병원서울4사무소', manager:'최진규', hosp_count:6,  grade_final:'B',  grade_quality:'A', grade_quant:'B',  total_target:41,  mbo_rate:0.2380,mbo_eval:'A',  result_sangjeong_rate:0.8049,result_eval:'A',  result_pass_rate:0.6364,result_pass_eval:'C', result_coding_rate:0.9524, mbo_vs:1.0050,mbo_vs_eval:'A', base_vs:0.9450,base_vs_eval:'B' },
    { division:'서울1사업부', office:'병원서울5사무소', manager:'하재필', hosp_count:2,  grade_final:'C',  grade_quality:'C', grade_quant:'C',  total_target:10,  mbo_rate:0.1200,mbo_eval:'C',  result_sangjeong_rate:0.1000,result_eval:'C',  result_pass_rate:0,     result_pass_eval:'C', result_coding_rate:0,      mbo_vs:0,     mbo_vs_eval:'C', base_vs:0,     base_vs_eval:'C' },
    { division:'서울1사업부', office:'병원인천사무소',  manager:'민병기', hosp_count:5,  grade_final:'Cp', grade_quality:'C', grade_quant:'B',  total_target:27,  mbo_rate:0.1980,mbo_eval:'B',  result_sangjeong_rate:0.4074,result_eval:'C',  result_pass_rate:0.8182,result_pass_eval:'B', result_coding_rate:1.0,    mbo_vs:0.9840,mbo_vs_eval:'B', base_vs:0.9200,base_vs_eval:'B' },
    { division:'서울2사업부', office:'제주사무소',     manager:'이동호', hosp_count:2,  grade_final:'Cp', grade_quality:'C', grade_quant:'Cp', total_target:6,   mbo_rate:0.1800,mbo_eval:'C',  result_sangjeong_rate:0.6667,result_eval:'B',  result_pass_rate:0.5,   result_pass_eval:'C', result_coding_rate:0.5,    mbo_vs:0.9220,mbo_vs_eval:'C', base_vs:0.8600,base_vs_eval:'C' },
    { division:'서울2사업부', office:'병원경기1사무소', manager:'이재빈', hosp_count:3,  grade_final:'Cp', grade_quality:'C', grade_quant:'B',  total_target:15,  mbo_rate:0.1900,mbo_eval:'B',  result_sangjeong_rate:0.4000,result_eval:'C',  result_pass_rate:0.8333,result_pass_eval:'B', result_coding_rate:1.0,    mbo_vs:0.9720,mbo_vs_eval:'B', base_vs:0.9000,base_vs_eval:'B' },
    { division:'서울2사업부', office:'병원경기2사무소', manager:'권봉기', hosp_count:2,  grade_final:'Cp', grade_quality:'C', grade_quant:'Cp', total_target:11,  mbo_rate:0.1750,mbo_eval:'C',  result_sangjeong_rate:0.5455,result_eval:'C',  result_pass_rate:0.6667,result_pass_eval:'C', result_coding_rate:0.25,   mbo_vs:0.8830,mbo_vs_eval:'C', base_vs:0.8100,base_vs_eval:'C' },
    { division:'서울2사업부', office:'병원남부1사무소', manager:'김선덕', hosp_count:6,  grade_final:'Cp', grade_quality:'C', grade_quant:'Cp', total_target:41,  mbo_rate:0.2010,mbo_eval:'B',  result_sangjeong_rate:0.4146,result_eval:'C',  result_pass_rate:0.3529,result_pass_eval:'C', result_coding_rate:1.0,    mbo_vs:0.9480,mbo_vs_eval:'C', base_vs:0.8700,base_vs_eval:'C' },
    { division:'서울2사업부', office:'병원남부2사무소', manager:'이석우', hosp_count:3,  grade_final:'Cp', grade_quality:'C', grade_quant:'Cp', total_target:29,  mbo_rate:0.1980,mbo_eval:'C',  result_sangjeong_rate:0.4483,result_eval:'C',  result_pass_rate:0.6923,result_pass_eval:'C', result_coding_rate:0.8889, mbo_vs:0.9670,mbo_vs_eval:'C', base_vs:0.8900,base_vs_eval:'C' },
    { division:'서울2사업부', office:'병원동부사무소',  manager:'이윤석', hosp_count:6,  grade_final:'B',  grade_quality:'B', grade_quant:'B',  total_target:44,  mbo_rate:0.2150,mbo_eval:'B',  result_sangjeong_rate:0.5455,result_eval:'C',  result_pass_rate:0.9583,result_pass_eval:'S', result_coding_rate:0.8261, mbo_vs:0.9850,mbo_vs_eval:'B', base_vs:0.9200,base_vs_eval:'B' },
    { division:'서울2사업부', office:'병원북부사무소',  manager:'박광영', hosp_count:5,  grade_final:'B',  grade_quality:'B', grade_quant:'B',  total_target:38,  mbo_rate:0.2050,mbo_eval:'B',  result_sangjeong_rate:0.5263,result_eval:'C',  result_pass_rate:0.8500,result_pass_eval:'B', result_coding_rate:0.7059, mbo_vs:0.9720,mbo_vs_eval:'B', base_vs:0.9000,base_vs_eval:'B' },
    { division:'서울2사업부', office:'병원중부1사무소', manager:'이주강', hosp_count:2,  grade_final:'Cp', grade_quality:'C', grade_quant:'Cp', total_target:28,  mbo_rate:0.1920,mbo_eval:'C',  result_sangjeong_rate:0.5714,result_eval:'C',  result_pass_rate:0.6250,result_pass_eval:'C', result_coding_rate:0.8,    mbo_vs:0.9540,mbo_vs_eval:'C', base_vs:0.8800,base_vs_eval:'C' },
    { division:'서울2사업부', office:'병원중부2사무소', manager:'최선일', hosp_count:2,  grade_final:'B',  grade_quality:'B', grade_quant:'B',  total_target:16,  mbo_rate:0.2120,mbo_eval:'B',  result_sangjeong_rate:0.5625,result_eval:'C',  result_pass_rate:0.8889,result_pass_eval:'B', result_coding_rate:1.111,  mbo_vs:1.0120,mbo_vs_eval:'A', base_vs:0.9600,base_vs_eval:'A' },
    { division:'지방1사업부', office:'병원경남1사무소', manager:'김상훈', hosp_count:1,  grade_final:'C',  grade_quality:'C', grade_quant:'C',  total_target:7,   mbo_rate:0.1600,mbo_eval:'C',  result_sangjeong_rate:0.2857,result_eval:'C',  result_pass_rate:1.0,   result_pass_eval:'S', result_coding_rate:1.0,    mbo_vs:0.9120,mbo_vs_eval:'C', base_vs:0.8500,base_vs_eval:'C' },
    { division:'지방1사업부', office:'병원경남2사무소', manager:'정철훈', hosp_count:3,  grade_final:'B',  grade_quality:'B', grade_quant:'B',  total_target:26,  mbo_rate:0.2050,mbo_eval:'B',  result_sangjeong_rate:0.4615,result_eval:'C',  result_pass_rate:0.9167,result_pass_eval:'A', result_coding_rate:0.7273, mbo_vs:0.9910,mbo_vs_eval:'A', base_vs:0.9300,base_vs_eval:'A' },
    { division:'지방1사업부', office:'병원대구1사무소', manager:'황선준', hosp_count:5,  grade_final:'Cp', grade_quality:'C', grade_quant:'Cp', total_target:32,  mbo_rate:0.2180,mbo_eval:'B',  result_sangjeong_rate:0.5938,result_eval:'C',  result_pass_rate:0.8421,result_pass_eval:'B', result_coding_rate:0.875,  mbo_vs:0.9780,mbo_vs_eval:'B', base_vs:0.9100,base_vs_eval:'B' },
    { division:'지방1사업부', office:'병원대구2사무소', manager:'양기호', hosp_count:6,  grade_final:'Cp', grade_quality:'C', grade_quant:'Cp', total_target:48,  mbo_rate:0.2250,mbo_eval:'B',  result_sangjeong_rate:0.5625,result_eval:'C',  result_pass_rate:0.7778,result_pass_eval:'B', result_coding_rate:0.8571, mbo_vs:0.9920,mbo_vs_eval:'A', base_vs:0.9250,base_vs_eval:'B' },
    { division:'지방1사업부', office:'병원부산1사무소', manager:'이창훈', hosp_count:4,  grade_final:'B',  grade_quality:'B', grade_quant:'B',  total_target:29,  mbo_rate:0.2300,mbo_eval:'B',  result_sangjeong_rate:0.6897,result_eval:'B',  result_pass_rate:0.9,   result_pass_eval:'A', result_coding_rate:0.7222, mbo_vs:0.9790,mbo_vs_eval:'B', base_vs:0.9200,base_vs_eval:'B' },
    { division:'지방1사업부', office:'병원부산2사무소', manager:'이준원', hosp_count:4,  grade_final:'B',  grade_quality:'B', grade_quant:'B',  total_target:38,  mbo_rate:0.2200,mbo_eval:'B',  result_sangjeong_rate:0.4211,result_eval:'C',  result_pass_rate:0.9375,result_pass_eval:'A', result_coding_rate:1.0,    mbo_vs:1.0050,mbo_vs_eval:'A', base_vs:0.9500,base_vs_eval:'A' },
    { division:'지방1사업부', office:'병원부산3사무소', manager:'이창형', hosp_count:4,  grade_final:'Cp', grade_quality:'C', grade_quant:'Cp', total_target:25,  mbo_rate:0.2100,mbo_eval:'B',  result_sangjeong_rate:0.36,  result_eval:'C',  result_pass_rate:0.7778,result_pass_eval:'B', result_coding_rate:1.0,    mbo_vs:0.9410,mbo_vs_eval:'C', base_vs:0.8800,base_vs_eval:'C' },
    { division:'지방2사업부', office:'병원광주1사무소', manager:'정지영', hosp_count:3,  grade_final:'Cp', grade_quality:'C', grade_quant:'Cp', total_target:23,  mbo_rate:0.2100,mbo_eval:'B',  result_sangjeong_rate:0.5217,result_eval:'C',  result_pass_rate:0.9167,result_pass_eval:'A', result_coding_rate:0.8182, mbo_vs:0.9780,mbo_vs_eval:'B', base_vs:0.9100,base_vs_eval:'B' },
    { division:'지방2사업부', office:'병원광주2사무소', manager:'노회원', hosp_count:3,  grade_final:'Bp', grade_quality:'B', grade_quant:'Bp', total_target:19,  mbo_rate:0.2250,mbo_eval:'B',  result_sangjeong_rate:0.5789,result_eval:'C',  result_pass_rate:0.8182,result_pass_eval:'B', result_coding_rate:1.0,    mbo_vs:1.0110,mbo_vs_eval:'A', base_vs:0.9600,base_vs_eval:'A' },
    { division:'지방2사업부', office:'병원대전사무소',  manager:'나영호', hosp_count:5,  grade_final:'B',  grade_quality:'A', grade_quant:'B',  total_target:22,  mbo_rate:0.2600,mbo_eval:'A',  result_sangjeong_rate:0.8636,result_eval:'A',  result_pass_rate:0.9474,result_pass_eval:'A', result_coding_rate:1.0,    mbo_vs:1.0250,mbo_vs_eval:'S', base_vs:0.9800,base_vs_eval:'A' },
    { division:'지방2사업부', office:'병원전주사무소',  manager:'김도영', hosp_count:3,  grade_final:'C',  grade_quality:'C', grade_quant:'C',  total_target:33,  mbo_rate:0.2150,mbo_eval:'B',  result_sangjeong_rate:0.6364,result_eval:'C',  result_pass_rate:0.8571,result_pass_eval:'B', result_coding_rate:0.8333, mbo_vs:0.9220,mbo_vs_eval:'C', base_vs:0.8600,base_vs_eval:'C' },
    { division:'지방2사업부', office:'병원청주사무소',  manager:'한재우', hosp_count:4,  grade_final:'Cp', grade_quality:'C', grade_quant:'Cp', total_target:27,  mbo_rate:0.2080,mbo_eval:'B',  result_sangjeong_rate:0.5556,result_eval:'C',  result_pass_rate:0.6667,result_pass_eval:'C', result_coding_rate:0.8,    mbo_vs:0.9880,mbo_vs_eval:'B', base_vs:0.9200,base_vs_eval:'B' },
  ],
  hospitalData: {
    '병원강원사무소': [
      { name:'강원대학교병원',    grade_final:'B',  grade_quality:'B', grade_quant:'B',  total_target:7,  mbo_plan:55.0,  mbo_rate:0.2100,mbo_eval:'B',  result_sangjeong_rate:0.5714,result_eval:'B',  result_pass_rate:1.0,   result_pass_eval:'S', result_coding_rate:0.75,   mbo_vs:0.9718,mbo_vs_eval:'B', base_vs:0.9100,base_vs_eval:'B', division:'서울1사업부',office:'병원강원사무소' },
      { name:'원주세브란스기독병원', grade_final:'Cp', grade_quality:'C', grade_quant:'Cp', total_target:9,  mbo_plan:80.0,  mbo_rate:0.1950,mbo_eval:'C',  result_sangjeong_rate:0.5556,result_eval:'C',  result_pass_rate:0.8,   result_pass_eval:'B', result_coding_rate:0.75,   mbo_vs:0.9352,mbo_vs_eval:'C', base_vs:0.8700,base_vs_eval:'C', division:'서울1사업부',office:'병원강원사무소' },
      { name:'춘천성심병원',       grade_final:'C',  grade_quality:'C', grade_quant:'C',  total_target:5,  mbo_plan:42.0,  mbo_rate:0.1800,mbo_eval:'C',  result_sangjeong_rate:0.4,   result_eval:'C',  result_pass_rate:1.0,   result_pass_eval:'S', result_coding_rate:0.5,    mbo_vs:0.5700,mbo_vs_eval:'C', base_vs:0.5200,base_vs_eval:'C', division:'서울1사업부',office:'병원강원사무소' },
      { name:'강릉아산병원',       grade_final:'B',  grade_quality:'B', grade_quant:'B',  total_target:5,  mbo_plan:33.5,  mbo_rate:0.2200,mbo_eval:'B',  result_sangjeong_rate:0.6,   result_eval:'C',  result_pass_rate:1.0,   result_pass_eval:'S', result_coding_rate:0.6667, mbo_vs:0.9143,mbo_vs_eval:'C', base_vs:0.8600,base_vs_eval:'C', division:'서울1사업부',office:'병원강원사무소' },
    ],
    '병원경인사무소': [
      { name:'분당서울대병원',         grade_final:'Cp', grade_quality:'C', grade_quant:'Cp', total_target:12, mbo_plan:88.0,  mbo_rate:0.1900,mbo_eval:'B',  result_sangjeong_rate:0.3333,result_eval:'C',  result_pass_rate:1.0,   result_pass_eval:'S', result_coding_rate:1.0,    mbo_vs:0.9464,mbo_vs_eval:'C', base_vs:0.8800,base_vs_eval:'C', division:'서울1사업부',office:'병원경인사무소' },
      { name:'아주대학교병원',          grade_final:'B',  grade_quality:'A', grade_quant:'B',  total_target:15, mbo_plan:120.0, mbo_rate:0.2050,mbo_eval:'A',  result_sangjeong_rate:0.4667,result_eval:'C',  result_pass_rate:1.0,   result_pass_eval:'S', result_coding_rate:0.8571, mbo_vs:0.9649,mbo_vs_eval:'B', base_vs:0.9200,base_vs_eval:'B', division:'서울1사업부',office:'병원경인사무소' },
      { name:'차의과학대학교분당차병원', grade_final:'C',  grade_quality:'C', grade_quant:'C',  total_target:8,  mbo_plan:60.0,  mbo_rate:0.1750,mbo_eval:'C',  result_sangjeong_rate:0.375, result_eval:'C',  result_pass_rate:1.0,   result_pass_eval:'S', result_coding_rate:1.0,    mbo_vs:0.8309,mbo_vs_eval:'C', base_vs:0.7800,base_vs_eval:'C', division:'서울1사업부',office:'병원경인사무소' },
      { name:'용인세브란스병원',         grade_final:'Cp', grade_quality:'C', grade_quant:'Cp', total_target:5,  mbo_plan:42.0,  mbo_rate:0.1600,mbo_eval:'C',  result_sangjeong_rate:0,     result_eval:'C',  result_pass_rate:0,     result_pass_eval:'C', result_coding_rate:0,      mbo_vs:0.5083,mbo_vs_eval:'C', base_vs:0.4500,base_vs_eval:'C', division:'서울1사업부',office:'병원경인사무소' },
    ],
    '병원인천사무소': [
      { name:'인하대학교병원',          grade_final:'Cp', grade_quality:'C', grade_quant:'B',  total_target:8,  mbo_plan:65.0,  mbo_rate:0.2000,mbo_eval:'B',  result_sangjeong_rate:0.375, result_eval:'C',  result_pass_rate:1.0,   result_pass_eval:'S', result_coding_rate:1.0,    mbo_vs:0.9514,mbo_vs_eval:'C', base_vs:0.8900,base_vs_eval:'C', division:'서울1사업부',office:'병원인천사무소' },
      { name:'인천성모병원',            grade_final:'B',  grade_quality:'B', grade_quant:'B',  total_target:6,  mbo_plan:55.0,  mbo_rate:0.1950,mbo_eval:'B',  result_sangjeong_rate:0.5,   result_eval:'C',  result_pass_rate:0.6667,result_pass_eval:'C', result_coding_rate:1.0,    mbo_vs:0.8667,mbo_vs_eval:'C', base_vs:0.8200,base_vs_eval:'C', division:'서울1사업부',office:'병원인천사무소' },
      { name:'길병원',                 grade_final:'C',  grade_quality:'C', grade_quant:'C',  total_target:7,  mbo_plan:72.0,  mbo_rate:0.1800,mbo_eval:'C',  result_sangjeong_rate:0.2857,result_eval:'C',  result_pass_rate:1.0,   result_pass_eval:'S', result_coding_rate:1.0,    mbo_vs:0.7750,mbo_vs_eval:'C', base_vs:0.7200,base_vs_eval:'C', division:'서울1사업부',office:'병원인천사무소' },
      { name:'가톨릭관동대학교국제성모병원', grade_final:'Cp', grade_quality:'C', grade_quant:'B',  total_target:6,  mbo_plan:48.0,  mbo_rate:0.2100,mbo_eval:'B',  result_sangjeong_rate:0.5,   result_eval:'C',  result_pass_rate:0.6667,result_pass_eval:'C', result_coding_rate:1.0,    mbo_vs:0.8558,mbo_vs_eval:'C', base_vs:0.8100,base_vs_eval:'C', division:'서울1사업부',office:'병원인천사무소' },
      { name:'계양병원',               grade_final:'C',  grade_quality:'C', grade_quant:'C',  total_target:0,  mbo_plan:0,     mbo_rate:0,     mbo_eval:null, result_sangjeong_rate:0,     result_eval:null, result_pass_rate:0,     result_pass_eval:null,result_coding_rate:0,      mbo_vs:null,  mbo_vs_eval:null,base_vs:null, base_vs_eval:null,division:'서울1사업부',office:'병원인천사무소' },
    ],
    '병원대전사무소': [
      { name:'충남대학교병원', grade_final:'Ap', grade_quality:'A', grade_quant:'Ap', total_target:8,  mbo_plan:58.0,  mbo_rate:0.2800,mbo_eval:'A',  result_sangjeong_rate:0.875, result_eval:'A',  result_pass_rate:1.0,   result_pass_eval:'S', result_coding_rate:1.0,    mbo_vs:1.0492,mbo_vs_eval:'S', base_vs:0.9900,base_vs_eval:'A', division:'지방2사업부',office:'병원대전사무소' },
      { name:'건양대학교병원', grade_final:'A',  grade_quality:'A', grade_quant:'A',  total_target:5,  mbo_plan:42.0,  mbo_rate:0.2500,mbo_eval:'A',  result_sangjeong_rate:1.0,   result_eval:'S',  result_pass_rate:0.8,   result_pass_eval:'B', result_coding_rate:1.0,    mbo_vs:0.9891,mbo_vs_eval:'A', base_vs:0.9600,base_vs_eval:'A', division:'지방2사업부',office:'병원대전사무소' },
      { name:'을지대학교병원', grade_final:'Ap', grade_quality:'A', grade_quant:'Ap', total_target:6,  mbo_plan:52.0,  mbo_rate:0.2600,mbo_eval:'A',  result_sangjeong_rate:0.8333,result_eval:'A',  result_pass_rate:0.8,   result_pass_eval:'B', result_coding_rate:1.0,    mbo_vs:0.9621,mbo_vs_eval:'A', base_vs:0.9300,base_vs_eval:'A', division:'지방2사업부',office:'병원대전사무소' },
      { name:'대전성모병원',   grade_final:'B',  grade_quality:'B', grade_quant:'B',  total_target:2,  mbo_plan:24.0,  mbo_rate:0.2200,mbo_eval:'B',  result_sangjeong_rate:1.0,   result_eval:'S',  result_pass_rate:1.0,   result_pass_eval:'S', result_coding_rate:1.0,    mbo_vs:0.9423,mbo_vs_eval:'C', base_vs:0.9000,base_vs_eval:'B', division:'지방2사업부',office:'병원대전사무소' },
      { name:'대전선병원',     grade_final:'A',  grade_quality:'A', grade_quant:'A',  total_target:1,  mbo_plan:22.0,  mbo_rate:0.2400,mbo_eval:'A',  result_sangjeong_rate:1.0,   result_eval:'S',  result_pass_rate:1.0,   result_pass_eval:'S', result_coding_rate:1.0,    mbo_vs:1.0333,mbo_vs_eval:'S', base_vs:1.0100,base_vs_eval:'S', division:'지방2사업부',office:'병원대전사무소' },
    ],
    '병원부산1사무소': [
      { name:'부산대학교병원', grade_final:'A',  grade_quality:'A', grade_quant:'B',  total_target:9,  mbo_plan:88.0,  mbo_rate:0.2350,mbo_eval:'A',  result_sangjeong_rate:0.7778,result_eval:'B',  result_pass_rate:0.8571,result_pass_eval:'B', result_coding_rate:0.8333, mbo_vs:0.9737,mbo_vs_eval:'B', base_vs:0.9200,base_vs_eval:'B', division:'지방1사업부',office:'병원부산1사무소' },
      { name:'동아대학교병원', grade_final:'B',  grade_quality:'B', grade_quant:'B',  total_target:10, mbo_plan:95.0,  mbo_rate:0.2280,mbo_eval:'B',  result_sangjeong_rate:0.7,   result_eval:'B',  result_pass_rate:0.8571,result_pass_eval:'B', result_coding_rate:0.6667, mbo_vs:0.9627,mbo_vs_eval:'B', base_vs:0.9100,base_vs_eval:'B', division:'지방1사업부',office:'병원부산1사무소' },
      { name:'부산성모병원',   grade_final:'Bp', grade_quality:'B', grade_quant:'Bp', total_target:6,  mbo_plan:52.0,  mbo_rate:0.2100,mbo_eval:'B',  result_sangjeong_rate:0.6667,result_eval:'B',  result_pass_rate:1.0,   result_pass_eval:'S', result_coding_rate:0.5,    mbo_vs:0.9103,mbo_vs_eval:'C', base_vs:0.8600,base_vs_eval:'C', division:'지방1사업부',office:'병원부산1사무소' },
      { name:'메리놀병원',     grade_final:'C',  grade_quality:'C', grade_quant:'C',  total_target:4,  mbo_plan:33.0,  mbo_rate:0.2000,mbo_eval:'C',  result_sangjeong_rate:0.5,   result_eval:'C',  result_pass_rate:1.0,   result_pass_eval:'S', result_coding_rate:1.0,    mbo_vs:0.2763,mbo_vs_eval:'C', base_vs:0.2500,base_vs_eval:'C', division:'지방1사업부',office:'병원부산1사무소' },
    ],
    '병원대구1사무소': [
      { name:'경북대학교병원',     grade_final:'Cp', grade_quality:'C', grade_quant:'Cp', total_target:7,  mbo_plan:68.0,  mbo_rate:0.2200,mbo_eval:'B',  result_sangjeong_rate:0.5714,result_eval:'C',  result_pass_rate:0.75,  result_pass_eval:'B', result_coding_rate:0.6667, mbo_vs:0.9257,mbo_vs_eval:'C', base_vs:0.8700,base_vs_eval:'C', division:'지방1사업부',office:'병원대구1사무소' },
      { name:'영남대학교병원',     grade_final:'C',  grade_quality:'C', grade_quant:'C',  total_target:8,  mbo_plan:72.0,  mbo_rate:0.2100,mbo_eval:'C',  result_sangjeong_rate:0.5,   result_eval:'C',  result_pass_rate:1.0,   result_pass_eval:'S', result_coding_rate:0.75,   mbo_vs:0.9063,mbo_vs_eval:'C', base_vs:0.8500,base_vs_eval:'C', division:'지방1사업부',office:'병원대구1사무소' },
      { name:'계명대학교동산병원', grade_final:'Cp', grade_quality:'C', grade_quant:'Cp', total_target:6,  mbo_plan:58.0,  mbo_rate:0.2050,mbo_eval:'B',  result_sangjeong_rate:0.5,   result_eval:'C',  result_pass_rate:1.0,   result_pass_eval:'S', result_coding_rate:1.0,    mbo_vs:0.9453,mbo_vs_eval:'C', base_vs:0.8900,base_vs_eval:'C', division:'지방1사업부',office:'병원대구1사무소' },
      { name:'대구가톨릭대학교병원', grade_final:'Cp', grade_quality:'C', grade_quant:'Cp', total_target:5,  mbo_plan:50.0,  mbo_rate:0.2150,mbo_eval:'B',  result_sangjeong_rate:0.6,   result_eval:'C',  result_pass_rate:1.0,   result_pass_eval:'S', result_coding_rate:1.0,    mbo_vs:0.9375,mbo_vs_eval:'C', base_vs:0.8800,base_vs_eval:'C', division:'지방1사업부',office:'병원대구1사무소' },
      { name:'파티마병원',         grade_final:'C',  grade_quality:'C', grade_quant:'C',  total_target:6,  mbo_plan:50.0,  mbo_rate:0.2000,mbo_eval:'C',  result_sangjeong_rate:0.8333,result_eval:'A',  result_pass_rate:0.6,   result_pass_eval:'C', result_coding_rate:1.0,    mbo_vs:0.5000,mbo_vs_eval:'C', base_vs:0.4800,base_vs_eval:'C', division:'지방1사업부',office:'병원대구1사무소' },
    ],
  },
};

// ─── 상수 ─────────────────────────────────────────────────────────────────────
const DIV_ORDER  = ['서울1사업부','서울2사업부','지방1사업부','지방2사업부'];
const DIV_COLORS = { '서울1사업부':'#3B82F6','서울2사업부':'#8B5CF6','지방1사업부':'#10B981','지방2사업부':'#F59E0B' };
const GRADE_ORDER = ['S','Ap','A','Bp','B','Cp','C'];
const GRADE_BG    = { S:'#1A3A6B',Ap:'#2A5A8C',A:'#3D5A8C',Bp:'#2A6B4A',B:'#5A9B72',Cp:'#C4703A',C:'#A03333' };

const gradeColor = g => GRADE_BG[g] || '#888';
const gradeLabel = g => g ? g.replace(/p$/,'+') : '-';
const gradeBase  = g => g ? g.replace(/p$/,'') : '';
const pctStr     = (v, dec=1) => v != null && v !== '' ? (v*100).toFixed(dec)+'%' : '-';
const officeDisp = n => n ? n.replace(/사무소$/,'').trim() : '';
const divDisp    = n => n ? n.replace('사업부','').trim() : '';

// ─── GradePill ────────────────────────────────────────────────────────────────
function GradePill({ grade, size='md' }) {
  if (!grade || grade==='-') return <span style={{color:'var(--ink-4)',fontSize:10}}>-</span>;
  const bg = gradeColor(grade);
  const style = size==='hero'
    ? { width:52, height:52, fontSize:22 }
    : size==='lg'
    ? { width:48, height:48, fontSize:20 }
    : size==='tbl'
    ? { minWidth:34, height:22, fontSize:12, padding:'0 5px', borderRadius:4 }
    : size==='sm'
    ? { minWidth:30, height:20, fontSize:11, padding:'0 5px', borderRadius:3 }
    : { minWidth:32, height:22, fontSize:12, padding:'0 5px', borderRadius:4 };
  return (
    <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', borderRadius:6, fontWeight:800, color:'#fff', background:bg, ...style }}>
      {gradeLabel(grade)}
    </span>
  );
}

// ─── GradeBox (트리오 한 칸) ──────────────────────────────────────────────────
function GradeBox({ label, grade, large=false }) {
  return (
    <div style={{ textAlign:'center', flex:1, background:'#FAFAF7', borderRadius: large?5:4, border:'1px solid var(--line-2)', padding: large?'8px 4px':'6px 3px', display:'flex', flexDirection:'column', justifyContent:'center' }}>
      <div style={{ fontSize:9, color:'var(--ink-3)', fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', marginBottom: large?5:4 }}>{label}</div>
      <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', margin:'0 auto', borderRadius: large?5:4, fontWeight:800, color:'#fff', background:gradeColor(grade),
        ...(large ? { width:42, height:36, fontSize:18 } : { width:38, height:30, fontSize:15 }) }}>
        {gradeLabel(grade)}
      </div>
    </div>
  );
}

// ─── MetricItem (label + % + 등급) ───────────────────────────────────────────
function MetricItem({ label, pct: pctVal, eval: evalVal }) {
  return (
    <div style={{ background:'#FAFAF7', border:'1px solid var(--line-2)', borderRadius:4, padding:'8px 10px', display:'flex', flexDirection:'column', justifyContent:'center', gap:3 }}>
      <div style={{ fontSize:9.5, color:'var(--ink-3)', fontWeight:700, letterSpacing:'.05em', textTransform:'uppercase' }}>{label}</div>
      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
        <span style={{ fontSize:13, fontWeight:700, color:'var(--ink-2)' }}>{pctStr(pctVal)}</span>
        {evalVal && <GradePill grade={evalVal} size="sm" />}
      </div>
    </div>
  );
}

// ─── EtcCard (full-width) ─────────────────────────────────────────────────────
function EtcCard({ total }) {
  if (!total) return null;
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:6, padding:'18px 20px 16px', position:'relative', marginBottom:14, display:'grid', gridTemplateColumns:'220px 1fr', gap:20, alignItems:'stretch' }}>
      <div style={{ position:'absolute', left:0, top:0, bottom:0, width:4, borderRadius:'6px 0 0 6px', background:'#1A3A6B' }} />
      {/* Left */}
      <div style={{ paddingLeft:8, display:'flex', flexDirection:'column' }}>
        <div style={{ fontSize:16, fontWeight:800, letterSpacing:'-.01em', paddingRight:60 }}>{total.name||'ETC 병원본부'}</div>
        <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:2, marginBottom:10 }}>전체 종합</div>
        <div style={{ position:'absolute', top:12, right:14 }}>
          <GradePill grade={total.grade_final} size="hero" />
        </div>
        <div style={{ display:'flex', gap:8, flex:1 }}>
          <GradeBox label="최종" grade={total.grade_final} large />
          <GradeBox label="정성" grade={total.grade_quality} large />
          <GradeBox label="정량" grade={total.grade_quant} large />
        </div>
        <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:10, paddingTop:8, borderTop:'1px solid var(--line-2)' }}>
          <b style={{ fontSize:15, fontWeight:800, color:'var(--ink)' }}>{total.hosp_count}</b>개 병원 · 목표&nbsp;
          <b style={{ fontSize:15, fontWeight:800, color:'var(--ink)' }}>{total.total_target}</b>품목
        </div>
      </div>
      {/* Right 3×2 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gridAutoRows:'1fr', gap:6 }}>
        <MetricItem label="MBO 달성"   pct={total.mbo_rate}              eval={total.mbo_eval} />
        <MetricItem label="신약 상정완료" pct={total.result_sangjeong_rate} eval={total.result_eval} />
        <MetricItem label="신약 통과완료" pct={total.result_pass_rate}      eval={total.result_pass_eval} />
        <MetricItem label="신약 코딩완료" pct={total.result_coding_rate} />
        <MetricItem label="MBO 대비"   pct={total.mbo_vs}                eval={total.mbo_vs_eval} />
        <MetricItem label="기준점 대비"  pct={total.base_vs}               eval={total.base_vs_eval} />
      </div>
    </div>
  );
}

// ─── DivCard ─────────────────────────────────────────────────────────────────
function DivCard({ div, isActive, onClick }) {
  const color = DIV_COLORS[div.name] || '#888';
  return (
    <div onClick={onClick} style={{ background:'var(--surface)', border:`${isActive?2:1}px solid ${isActive?color:'var(--line)'}`, borderRadius:6, padding:'16px 16px 14px', position:'relative', cursor:'pointer', transition:'box-shadow .15s,border-color .15s', boxShadow: isActive?`0 4px 16px ${color}33`:undefined }}>
      <div style={{ position:'absolute', left:0, top:0, bottom:0, width:4, borderRadius:'6px 0 0 6px', background:color }} />
      <div style={{ fontSize:14, fontWeight:700, paddingLeft:8, paddingRight:58, marginBottom:1 }}>{divDisp(div.name)}</div>
      <div style={{ fontSize:11, color:'var(--ink-3)', paddingLeft:8, marginBottom:8 }}>{div.manager}</div>
      <div style={{ position:'absolute', top:12, right:12, width:48, height:48, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:800, borderRadius:6, color:'#fff', background:gradeColor(div.grade_final) }}>
        {gradeLabel(div.grade_final)}
      </div>
      {/* Grade trio sm */}
      <div style={{ display:'flex', gap:5, paddingLeft:8, marginBottom:8 }}>
        <GradeBox label="최종" grade={div.grade_final} />
        <GradeBox label="정성" grade={div.grade_quality} />
        <GradeBox label="정량" grade={div.grade_quant} />
      </div>
      {/* 6 metrics 2-col */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, paddingLeft:8, marginBottom:8 }}>
        {[
          { label:'MBO 달성',   pct:div.mbo_rate,              eval:div.mbo_eval },
          { label:'신약 상정',   pct:div.result_sangjeong_rate, eval:div.result_eval },
          { label:'신약 통과',   pct:div.result_pass_rate,      eval:div.result_pass_eval },
          { label:'신약 코딩',   pct:div.result_coding_rate },
          { label:'MBO 대비',   pct:div.mbo_vs,                eval:div.mbo_vs_eval },
          { label:'기준점 대비', pct:div.base_vs,               eval:div.base_vs_eval },
        ].map(m => (
          <div key={m.label} style={{ background:'#FAFAF7', border:'1px solid var(--line-2)', borderRadius:4, padding:'5px 6px' }}>
            <div style={{ fontSize:9, color:'var(--ink-3)', fontWeight:700, letterSpacing:'.04em', textTransform:'uppercase', marginBottom:2 }}>{m.label}</div>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ fontSize:12, fontWeight:700, color:'var(--ink-2)' }}>{pctStr(m.pct)}</span>
              {m.eval && <GradePill grade={m.eval} size="sm" />}
            </div>
          </div>
        ))}
      </div>
      {/* 병원수 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingLeft:8, paddingTop:8, borderTop:'1px solid var(--line-2)', fontSize:11, color:'var(--ink-3)' }}>
        <span>병원수</span>
        <span><b style={{ fontSize:14, fontWeight:800, color:'var(--ink)' }}>{div.hosp_count}</b>개</span>
      </div>
    </div>
  );
}

// ─── OfficeTableHead (18열 2단) ───────────────────────────────────────────────
function OfficeTableHead({ sortField, sortAsc, onSort }) {
  const base = 'px-2 py-1.5 text-center border border-[var(--line-2)] whitespace-nowrap bg-[#FAF8F1] text-[10px] font-bold text-[var(--ink-3)]';
  const sortable = `${base} cursor-pointer hover:bg-[var(--line-2)]`;
  const Si = ({ f }) => (
    <span className="ml-0.5 opacity-50 text-[8px]">
      {sortField===f ? (sortAsc?'▲':'▼') : '⇅'}
    </span>
  );
  const S = ({ f, children }) => (
    <th className={sortable} onClick={() => onSort(f)}>{children}<Si f={f} /></th>
  );
  const F = ({ children, colSpan, rowSpan, left }) => (
    <th className={`${base}${left?' text-left':''}`} colSpan={colSpan} rowSpan={rowSpan}>{children}</th>
  );
  return (
    <thead>
      <tr>
        <F rowSpan={2}>#</F>
        <F rowSpan={2} left>사무소</F>
        <F rowSpan={2} left>소장</F>
        <F rowSpan={2}>병원<br/>수</F>
        <F colSpan={3}>평 가</F>
        <F colSpan={2}>MBO</F>
        <F colSpan={2}>신약 상정완료</F>
        <F colSpan={2}>신약 통과완료</F>
        <F rowSpan={2}>신약<br/>코딩완료%</F>
        <F colSpan={2}>MBO대비</F>
        <F colSpan={2}>기준점대비</F>
      </tr>
      <tr>
        <S f="grade_final">최종</S>
        <S f="grade_quality">정성</S>
        <S f="grade_quant">정량</S>
        <S f="mbo_rate">%</S>
        <F>평가</F>
        <S f="result_sangjeong_rate">%</S>
        <F>평가</F>
        <S f="result_pass_rate">%</S>
        <F>평가</F>
        <S f="mbo_vs">%</S>
        <F>평가</F>
        <S f="base_vs">%</S>
        <F>평가</F>
      </tr>
    </thead>
  );
}

// ─── OfficeRow (18열) ─────────────────────────────────────────────────────────
function OfficeRow({ office, idx, onClick }) {
  const td = 'px-2 py-2 text-xs border-t border-[var(--line-2)]';
  return (
    <tr className="hover:bg-[#FCFAF3] transition-colors" style={{ cursor:'pointer' }} onClick={onClick}>
      <td className={`${td} text-center text-[var(--ink-4)]`}>{idx+1}</td>
      <td className={`${td} whitespace-nowrap`}>
        <span style={{ color:'#3D5A8C', fontWeight:700, cursor:'pointer', borderBottom:'1px dashed #3D5A8C', paddingBottom:1 }}>
          {officeDisp(office.office)}
        </span>
      </td>
      <td className={`${td} text-[var(--ink-3)] whitespace-nowrap`}>{office.manager}</td>
      <td className={`${td} text-center font-bold`}>{office.hosp_count}</td>
      <td className={`${td} text-center`}><GradePill grade={office.grade_final}   size="tbl" /></td>
      <td className={`${td} text-center`}><GradePill grade={office.grade_quality} size="tbl" /></td>
      <td className={`${td} text-center`}><GradePill grade={office.grade_quant}   size="tbl" /></td>
      <td className={`${td} text-right tabular-nums`}>{pctStr(office.mbo_rate)}</td>
      <td className={`${td} text-center`}><GradePill grade={office.mbo_eval}      size="sm" /></td>
      <td className={`${td} text-right tabular-nums`}>{pctStr(office.result_sangjeong_rate)}</td>
      <td className={`${td} text-center`}><GradePill grade={office.result_eval}      size="sm" /></td>
      <td className={`${td} text-right tabular-nums`}>{pctStr(office.result_pass_rate)}</td>
      <td className={`${td} text-center`}><GradePill grade={office.result_pass_eval} size="sm" /></td>
      <td className={`${td} text-right tabular-nums`}>{pctStr(office.result_coding_rate)}</td>
      <td className={`${td} text-right tabular-nums`}>{pctStr(office.mbo_vs)}</td>
      <td className={`${td} text-center`}><GradePill grade={office.mbo_vs_eval}  size="sm" /></td>
      <td className={`${td} text-right tabular-nums`}>{pctStr(office.base_vs)}</td>
      <td className={`${td} text-center`}><GradePill grade={office.base_vs_eval} size="sm" /></td>
    </tr>
  );
}

// ─── GroupHeaderRow ───────────────────────────────────────────────────────────
function GroupHeaderRow({ divName }) {
  return (
    <tr style={{ background:'#EDEBE4' }}>
      <td colSpan={18} style={{ textAlign:'left', fontSize:10.5, fontWeight:800, color:'var(--ink-2)', letterSpacing:'.1em', textTransform:'uppercase', padding:'6px 12px' }}>
        {divDisp(divName)} 사업부
      </td>
    </tr>
  );
}

// ─── HospModal ────────────────────────────────────────────────────────────────
function HospModal({ office, hospitals, onClose }) {
  if (!office) return null;
  const th = 'px-2 py-1.5 bg-[#FAF8F1] border border-[var(--line-2)] text-[10px] font-bold text-[var(--ink-3)] whitespace-nowrap';
  const sorted = [...hospitals].sort((a, b) => {
    const ar = a.result_sangjeong_rate ?? a.sangjeong_rate ?? 0;
    const br = b.result_sangjeong_rate ?? b.sangjeong_rate ?? 0;
    return br - ar;
  });
  return (
    <div className="modal-overlay" onClick={e => { if (e.target===e.currentTarget) onClose(); }}>
      <div className="modal-content animate-in" style={{ maxWidth:1100 }}>
        {/* Header */}
        <div style={{ padding:'18px 22px 14px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'flex-start', gap:14, flexShrink:0 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, letterSpacing:'.16em', color:'var(--ink-4)', fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>
              {divDisp(office.division)} 사업부
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
              <span style={{ fontSize:20, fontWeight:800, letterSpacing:'-.02em' }}>{officeDisp(office.office)}</span>
              <GradePill grade={office.grade_final} size="lg" />
            </div>
            <div style={{ display:'flex', gap:6, marginBottom:6 }}>
              <GradeBox label="정성" grade={office.grade_quality} />
              <GradeBox label="정량" grade={office.grade_quant} />
            </div>
            <div style={{ fontSize:12, color:'var(--ink-3)' }}>
              소장 {office.manager} · {office.hosp_count}개 병원 · 목표 {office.total_target}품목
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'1px solid var(--line)', color:'var(--ink-3)', width:30, height:30, borderRadius:6, cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✕</button>
        </div>

        <div style={{ padding:'16px 22px 20px', overflowY:'auto', maxHeight:'calc(88vh - 120px)' }}>
          {/* 6 KPI */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:14 }}>
            {[
              { label:'MBO 달성',   pct:office.mbo_rate,              eval:office.mbo_eval,         color:'#EFF6FF', c:'#1D4ED8' },
              { label:'신약 상정완료', pct:office.result_sangjeong_rate, eval:office.result_eval,      color:'#EDE9FE', c:'#7C3AED' },
              { label:'신약 통과완료', pct:office.result_pass_rate,      eval:office.result_pass_eval, color:'#ECFDF5', c:'#059669' },
              { label:'신약 코딩완료', pct:office.result_coding_rate,                                   color:'#F5F3FF', c:'#6D28D9' },
              { label:'MBO 대비',   pct:office.mbo_vs,                eval:office.mbo_vs_eval,      color:'#FFFBEB', c:'#B45309' },
              { label:'기준점 대비',  pct:office.base_vs,               eval:office.base_vs_eval,     color:'#FFF1F2', c:'#BE123C' },
            ].map(k => (
              <div key={k.label} style={{ padding:'10px 12px', background:k.color, borderRadius:5, border:'1px solid var(--line-2)' }}>
                <div style={{ fontSize:10, letterSpacing:'.06em', color:k.c, fontWeight:700, textTransform:'uppercase', marginBottom:3 }}>{k.label}</div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:22, fontWeight:800, letterSpacing:'-.02em', color:k.c }}>{pctStr(k.pct)}</span>
                  {k.eval && <GradePill grade={k.eval} size="sm" />}
                </div>
              </div>
            ))}
          </div>

          {/* Hospital table — 16열 */}
          <div style={{ border:'1px solid var(--line)', borderRadius:6, overflow:'hidden' }}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:960 }}>
                <thead>
                  <tr>
                    <th className={`${th} text-center`} rowSpan={2}>#</th>
                    <th className={`${th} text-left`} rowSpan={2}>병원명</th>
                    <th className={th} colSpan={3}>평 가</th>
                    <th className={th} colSpan={2}>MBO</th>
                    <th className={th} colSpan={2}>신약 상정완료</th>
                    <th className={th} colSpan={2}>신약 통과완료</th>
                    <th className={`${th} text-center`} rowSpan={2}>신약<br/>코딩완료%</th>
                    <th className={th} colSpan={2}>MBO대비</th>
                    <th className={th} colSpan={2}>기준점대비</th>
                  </tr>
                  <tr>
                    <th className={`${th} text-center`}>최종</th>
                    <th className={`${th} text-center`}>정성</th>
                    <th className={`${th} text-center`}>정량</th>
                    <th className={`${th} text-right`}>%</th>
                    <th className={`${th} text-center`}>평가</th>
                    <th className={`${th} text-right`}>%</th>
                    <th className={`${th} text-center`}>평가</th>
                    <th className={`${th} text-right`}>%</th>
                    <th className={`${th} text-center`}>평가</th>
                    <th className={`${th} text-right`}>%</th>
                    <th className={`${th} text-center`}>평가</th>
                    <th className={`${th} text-right`}>%</th>
                    <th className={`${th} text-center`}>평가</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((h, i) => (
                    <tr key={i} style={{ borderTop:'1px solid var(--line-2)' }} className="hover:bg-[#FCFAF3]">
                      <td className="px-2 py-2 text-center text-[var(--ink-4)] text-[11px]">{i+1}</td>
                      <td className="px-2 py-2 font-bold text-[12.5px] text-[var(--ink)] whitespace-nowrap">{h.name}</td>
                      <td className="px-2 py-2 text-center"><GradePill grade={h.grade_final}   size="tbl" /></td>
                      <td className="px-2 py-2 text-center"><GradePill grade={h.grade_quality} size="sm" /></td>
                      <td className="px-2 py-2 text-center"><GradePill grade={h.grade_quant}   size="sm" /></td>
                      <td className="px-2 py-2 text-right tabular-nums">{pctStr(h.mbo_rate)}</td>
                      <td className="px-2 py-2 text-center"><GradePill grade={h.mbo_eval}         size="sm" /></td>
                      <td className="px-2 py-2 text-right tabular-nums">{pctStr(h.result_sangjeong_rate ?? h.sangjeong_rate)}</td>
                      <td className="px-2 py-2 text-center"><GradePill grade={h.result_eval}      size="sm" /></td>
                      <td className="px-2 py-2 text-right tabular-nums">{pctStr(h.result_pass_rate ?? h.pass_rate)}</td>
                      <td className="px-2 py-2 text-center"><GradePill grade={h.result_pass_eval} size="sm" /></td>
                      <td className="px-2 py-2 text-right tabular-nums">{pctStr(h.result_coding_rate ?? h.coding_rate)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{pctStr(h.mbo_vs)}</td>
                      <td className="px-2 py-2 text-center"><GradePill grade={h.mbo_vs_eval}  size="sm" /></td>
                      <td className="px-2 py-2 text-right tabular-nums">{pctStr(h.base_vs)}</td>
                      <td className="px-2 py-2 text-center"><GradePill grade={h.base_vs_eval} size="sm" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sorted.length===0 && (
                <div style={{ padding:'40px 0', textAlign:'center', color:'var(--ink-4)', fontSize:14 }}>병원 데이터가 없습니다</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard110({ isAdmin, period }) {
  const [data, setData] = useState(DEMO);
  const [cloudLoading, setCloudLoading]     = useState(true);
  const [isLoading, setIsLoading]           = useState(false);
  const [uploadError, setUploadError]       = useState(null);
  const [divFilter, setDivFilter]           = useState(null);
  const [sortField, setSortField]           = useState(null);
  const [sortAsc, setSortAsc]               = useState(false);
  const [selectedOffice, setSelectedOffice] = useState(null);

  // ── 초기 로딩: Firestore에서 데이터 불러오기 ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadDashboard('hospital110');
      if (cancelled) return;
      if (stored) {
        setData({ ...stored, hospitalData: { ...DEMO.hospitalData, ...(stored.hospitalData||{}) } });
      }
      setCloudLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleFile = useCallback(async (file) => {
    setIsLoading(true);
    setUploadError(null);
    try {
      const parsed = await parse110ExcelFile(file);
      parsed.period = period;
      const existing = await loadDashboard('hospital110');
      const merged = mergeMonthlyData(existing, parsed);
      await saveDashboard('hospital110', merged);
      setData(merged);
    } catch (err) {
      setUploadError('업로드 오류: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  const displayData = useMemo(() => {
    if (!period || period===data.period) return data;
    const hist = data.history?.[period];
    if (hist) return { ...data, ...hist, period };
    return null;
  }, [data, period]);

  // ── 모든 Hook은 조건부 return 전에 ──────────────────────────────────────────
  const { total, divisions=[], offices=[], hospitalData={} } = displayData || {};

  const filteredOffices = useMemo(() => {
    let list = offices;
    if (divFilter) list = list.filter(o => o.division===divFilter);
    if (!sortField) {
      return [...list].sort((a,b) => {
        const ai = DIV_ORDER.indexOf(a.division), bi = DIV_ORDER.indexOf(b.division);
        if (ai!==bi) return ai-bi;
        return (a.office||'').localeCompare(b.office||'','ko');
      });
    }
    return [...list].sort((a,b) => {
      if (['grade_final','grade_quality','grade_quant'].includes(sortField)) {
        const d = GRADE_ORDER.indexOf(a[sortField]) - GRADE_ORDER.indexOf(b[sortField]);
        return sortAsc ? d : -d;
      }
      const av = a[sortField]??0, bv = b[sortField]??0;
      return sortAsc ? av-bv : bv-av;
    });
  }, [offices, divFilter, sortField, sortAsc]);

  // 기간 데이터 없음
  if (!displayData) {
    return (
      <div>
        {isAdmin && (
          <div className="mb-8">
            <label className="flex items-center justify-center gap-3 p-6 border-2 border-dashed rounded-2xl cursor-pointer hover:border-[var(--accent)] hover:bg-blue-50/30 border-[var(--line)]">
              <span className="text-2xl">💊</span>
              <div>
                <div className="text-sm font-medium text-[var(--ink-2)]">110대병원 엑셀 파일 업로드</div>
                <div className="text-xs text-[var(--ink-4)]">○{period} 110대병원 신규품목 현황.xlsx</div>
              </div>
              <input type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => e.target.files[0] && handleFile(e.target.files[0])} disabled={isLoading} />
            </label>
          </div>
        )}
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <div className="text-6xl mb-5">📭</div>
          <div className="text-base font-bold text-[var(--ink-2)] mb-2">{period} 데이터가 없습니다</div>
          <div className="text-sm text-[var(--ink-4)] leading-relaxed">
            해당 기간의 데이터가 아직 업데이트되지 않았습니다.<br />
            {isAdmin ? '위에서 엑셀 파일을 업로드해주세요.' : '관리자에게 문의하거나 나중에 다시 확인해주세요.'}
          </div>
        </div>
      </div>
    );
  }

  const showGroups = !divFilter && !sortField;

  const handleSort = f => {
    if (sortField===f) setSortAsc(p => !p);
    else { setSortField(f); setSortAsc(false); }
  };
  const handleDivChip = dName => {
    setDivFilter(prev => prev===dName ? null : dName);
    setSortField(null);
  };

  const handleDeletePeriod = async () => {
    if (!window.confirm(`${period} 데이터를 삭제하시겠습니까?\n삭제 후 재업로드할 수 있습니다.`)) return;
    setIsLoading(true);
    try {
      const stored = await loadDashboard('hospital110');
      if (!stored) { setData(DEMO); return; }
      const updated = { ...stored, history:{ ...(stored.history||{}) } };
      delete updated.history[period];
      if (updated.period===period) {
        const remaining = Object.keys(updated.history);
        if (remaining.length>0) {
          const prev = remaining[remaining.length-1];
          const h = updated.history[prev];
          updated.period=prev; updated.total=h.total; updated.divisions=h.divisions;
          updated.offices=h.offices; updated.hospitalData={};
        } else {
          await saveDashboard('hospital110', { period: null, total: null, divisions: [], offices: [], hospitalData: {}, history: {} });
          setData(DEMO);
          return;
        }
      }
      await saveDashboard('hospital110', updated);
      setData(updated);
    } catch (err) {
      setUploadError('삭제 오류: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/* Admin 업로드 + 삭제 */}
      {isAdmin && (
        <div className="mb-8">
          <div className="flex gap-2 items-stretch">
            <label className={`flex-1 flex items-center justify-center gap-3 p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${isLoading?'opacity-60':'hover:border-[var(--accent)] hover:bg-blue-50/30'} border-[var(--line)]`}>
              <span className="text-2xl">💊</span>
              <div>
                <div className="text-sm font-medium text-[var(--ink-2)]">{isLoading?'처리 중...':'110대병원 엑셀 파일 업로드'}</div>
                <div className="text-xs text-[var(--ink-4)]">○26년 X월 110대병원 신규품목 현황.xlsx</div>
              </div>
              <input type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => e.target.files[0] && handleFile(e.target.files[0])} disabled={isLoading} />
            </label>
            <button onClick={handleDeletePeriod}
              className="flex flex-col items-center justify-center gap-1 px-5 rounded-2xl border-2 border-dashed border-red-200 text-red-400 hover:bg-red-50 hover:border-red-400 hover:text-red-600 transition-all text-xs font-medium whitespace-nowrap"
              title={`${period} 데이터 삭제`}>
              <span className="text-lg">🗑️</span>
              <span>{period}</span>
              <span>데이터 삭제</span>
            </button>
          </div>
          {uploadError && (
            <div className="mt-2 text-xs text-[var(--neg)] bg-red-50 border border-red-200 rounded-lg px-4 py-2">{uploadError}</div>
          )}
        </div>
      )}

      {/* ── 01. 사업부별 현황 ── */}
      <section className="mb-10">
        <div className="flex items-baseline gap-3 mb-4 pb-2.5 border-b border-[var(--line)] flex-wrap">
          <span className="text-[11px] font-semibold text-[var(--ink-4)] tracking-wider">01</span>
          <span className="text-lg font-bold text-[var(--ink)]">사업부별 현황</span>
          <span className="text-xs text-[var(--ink-3)] ml-auto">카드 클릭 → 사무소 필터 · 기준: {displayData.period}</span>
        </div>
        <EtcCard total={total} />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
          {DIV_ORDER.map(dName => {
            const div = divisions.find(d => d.name===dName);
            if (!div) return null;
            return <DivCard key={dName} div={div} isActive={divFilter===dName} onClick={() => handleDivChip(dName)} />;
          })}
        </div>
      </section>

      {/* ── 02. 사무소별 현황 ── */}
      <section className="mb-10">
        <div className="flex items-baseline gap-3 mb-4 pb-2.5 border-b border-[var(--line)] flex-wrap">
          <span className="text-[11px] font-semibold text-[var(--ink-4)] tracking-wider">02</span>
          <span className="text-lg font-bold text-[var(--ink)]">사무소별 현황</span>
          <span className="text-xs text-[var(--ink-3)] ml-auto">사무소명 클릭 → 병원 세부현황</span>
        </div>

        {/* 사업부 칩 필터 */}
        <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
          {[null, ...DIV_ORDER].map(d => {
            const label = d ? divDisp(d) : '전체';
            const cnt   = d ? offices.filter(o => o.division===d).length : offices.length;
            const isOn  = divFilter===d;
            return (
              <button key={label} onClick={() => handleDivChip(d)}
                style={{ padding:'6px 14px', border:`1px solid ${isOn?'var(--ink)':'var(--line)'}`, background:isOn?'var(--ink)':'var(--surface)', borderRadius:20, fontSize:11.5, fontWeight:600, color:isOn?'#fff':'var(--ink-2)', cursor:'pointer', transition:'all .15s', fontFamily:'inherit' }}>
                {label}
                <span style={{ marginLeft:5, fontSize:10, opacity:.55, fontWeight:500 }}>({cnt})</span>
              </button>
            );
          })}
        </div>

        {/* 사무소 테이블 */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:6, overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:1120 }}>
              <OfficeTableHead sortField={sortField} sortAsc={sortAsc} onSort={handleSort} />
              <tbody>
                {showGroups
                  ? filteredOffices.reduce((acc, o, idx) => {
                      const prev = filteredOffices[idx - 1];
                      if (!prev || prev.division !== o.division) {
                        acc.push(<GroupHeaderRow key={`grp-${o.division}-${idx}`} divName={o.division} />);
                      }
                      acc.push(<OfficeRow key={o.office + idx} office={o} idx={idx} onClick={() => setSelectedOffice(o)} />);
                      return acc;
                    }, [])
                  : filteredOffices.map((o, idx) => (
                      <OfficeRow key={o.office+idx} office={o} idx={idx} onClick={() => setSelectedOffice(o)} />
                    ))
                }
              </tbody>
            </table>
            {filteredOffices.length===0 && (
              <div style={{ padding:'40px 0', textAlign:'center', color:'var(--ink-4)', fontSize:14 }}>조건에 맞는 사무소가 없습니다</div>
            )}
          </div>
        </div>
      </section>

      {selectedOffice && (
        <HospModal
          office={selectedOffice}
          hospitals={hospitalData[selectedOffice.office]||[]}
          onClose={() => setSelectedOffice(null)}
        />
      )}
    </div>
  );
}
