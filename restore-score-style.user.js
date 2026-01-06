// ==UserScript==
// @name         PKU树洞成绩查询样式恢复
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  恢复PKU树洞成绩查询页面的原始样式
// @author       Restored
// @match        *://treehole.pku.edu.cn/*
// @match        *://pkuhelper.pku.edu.cn/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const GRADE_MAP = {
        'P': null, 'NP': null, 'EX': null, 'IP': null, 'I': null, 'W': null,
        'A+': 4, 'A': 4, 'A-': 3.7, 'B+': 3.3, 'B': 3, 'B-': 2.7,
        'C+': 2.3, 'C': 2, 'C-': 1.7, 'D+': 1.3, 'D': 1, 'F': null
    };

    const SPECIAL_TEXT = {
        'P': '通过', 'NP': '未通过', 'EX': '免修',
        'IP': '跨学期', 'I': '缓考', 'W': '退课'
    };

    function scoreToGPA(score) {
        if (score === null || score === undefined) return null;
        if (typeof score === 'string') {
            if (GRADE_MAP.hasOwnProperty(score)) return GRADE_MAP[score];
            let n = parseFloat(score);
            if (!isNaN(n)) score = n;
            else return null;
        }
        return score >= 60 ? 4 - 3 * Math.pow(100 - score, 2) / 1600 : null;
    }

    function gpaTo100(gpa) {
        if (gpa === null) return null;
        if (gpa >= 4) return 100;
        if (gpa >= 1) return (-40 * Math.sqrt(3) * Math.sqrt(4 - gpa) + 300) / 3;
        return null;
    }

    function calcRatio(score, useGPA) {
        let gpa = scoreToGPA(score);
        if (gpa === null) return 0;
        if (useGPA) return (gpa - 1) / 3;
        let s100 = gpaTo100(gpa);
        return (s100 - 60) / 40;
    }

    function isNull(score) {
        return scoreToGPA(score) === null;
    }

    function isFail(score) {
        return score === 'NP' || score === 'F' || (typeof score === 'number' && score < 60);
    }

    function getTitleColor(score, useGPA) {
        if (isNull(score)) return 'hsl(240,30%,88%)';
        return `hsl(${120 * calcRatio(score, useGPA)},${useGPA ? 97 : 100}%,70%)`;
    }

    function getGradient(score, useGPA) {
        if (isNull(score) || (typeof score === 'number' && score < 60)) {
            let ratio = isFail(score) ? 0 : 1;
            let pct = ratio * 100 + '%';
            return { bg: `linear-gradient(to right, hsl(240,30%,88%), hsl(240,30%,88%) ${pct}, hsl(340,60%,65%) ${pct})`, ratio: ratio };
        }
        let r = calcRatio(score, useGPA);
        let c1 = `hsl(${120*r},${useGPA?97:100}%,75%)`;
        let c2 = `hsl(${120*r},${useGPA?97:100}%,70%)`;
        let c3 = `hsl(${120*r},${useGPA?57:60}%,65%)`;
        let pct = Math.max(r, 0.01) * 100 + '%';
        return { bg: `linear-gradient(to right, ${c1}, ${c2} ${pct}, ${c3} ${pct})`, ratio: Math.max(r, 0.01) };
    }

    function formatNumber(n, decimals) {
        if (typeof n !== 'number') return n;
        return n.toFixed(decimals).replace(/\.?0+$/, '');
    }

    function getGPADisplay(score) {
        let gpa = scoreToGPA(score);
        if (gpa !== null) return gpa.toFixed(2);
        if (typeof score === 'string' && SPECIAL_TEXT[score]) return SPECIAL_TEXT[score];
        return '-.--';
    }

    function getScoreDisplay(score) {
        if (typeof score == 'string' && score == '合格') return 'P';
        if (typeof score == 'string' && score == '缓考') return 'I';
        if (typeof score === 'number') return formatNumber(score, 1);
        return score || '-.--';
    }

    (function() {
        let style = document.createElement('style');
        style.textContent = `
            .container { color: #fff !important; }
            .controller-bar { color: #add8e6 !important; }
            .controller-bar a { color: #add8e6 !important; cursor: pointer; }
            .controller-bar.new-color a { color: #add8e6 !important; }
            .osu-text { color: #fff !important; }
            .footer { color: #add8e6 !important; text-align: center !important; margin: 2rem 0; padding-bottom: 3rem; }
            .footer p { color: #add8e6 !important; }
            .controller-bar-tip { color: #add8e6 !important; text-align: center !important; }

            .semester-block > :first-child {
                box-shadow: 0 0 6px rgba(0,0,0,.8) !important;
                border: none !important;
            }
            .semester-block > :first-child .layout-row {
                padding-top: 0.25em !important;
                padding-bottom: 0.25em !important;
            }
            .course-row {
                box-shadow: 0 -1px 0 #7f7f7f !important;
                border: none !important;
            }

            .rainbow-moving {
                background-image: linear-gradient(-45deg,#c5fcc5,#ffd1d1,#d1d1ff,#c5fcc5,#ffd1d1,#d1d1ff,#c5fcc5,#ffd1d1,#d1d1ff,#c5fcc5,#ffd1d1,#d1d1ff,#c5fcc5) !important;
                background-size: 1800px 200px !important;
            }

            #gm-color-toggle { margin-left: 0.8em; cursor: pointer; }

            .gm-credit-cell {
                flex: 0 0 2.5em; text-align: center;
            }
            .gm-credit-cell .layout-vertical-up { font-size: 1em; }
            .gm-credit-cell .layout-vertical-down { font-size: 60%; }
        `;
        if (document.head) {
            document.head.appendChild(style);
        } else {
            document.addEventListener('DOMContentLoaded', function() {
                document.head.appendChild(style);
            });
        }
    })();

    let useGPAMode = false;
    let gmOrderCounter = 0;

    function getDataVAttrs(el) {
        if (!el) return [];
        return Array.from(el.attributes).filter(a => a.name.startsWith('data-v-')).map(a => [a.name, a.value]);
    }

    function applyDataVAttrs(el, attrs) {
        attrs.forEach(a => el.setAttribute(a[0], a[1]));
        return el;
    }

    function gpaTo100Display(gpa) {
        let v = gpaTo100(gpa);
        return v === null ? '--.-' : v;
    }

    function parseScore(text) {
        if (!text) return null;
        text = text.trim();
        if (text.includes('缓考')) return 'I';
        if (text.includes('跨学期')) return 'IP';
        if (text.includes('退课')) return 'W';
        if (GRADE_MAP.hasOwnProperty(text)) return text;
        if (SPECIAL_TEXT.hasOwnProperty(text)) {
            for (let k in SPECIAL_TEXT) {
                if (SPECIAL_TEXT[k] === text) return k;
            }
        }
        let n = parseFloat(text);
        return isNaN(n) ? text : n;
    }

    function isCreditExcluded(score) {
        return score === 'W' || score === 'I';
    }

    function getCreditFromRow(row) {
        let leftDiv = row.querySelector('.layout-row-left .layout-vertical-up');
        if (leftDiv) return parseFloat(leftDiv.textContent) || 0;
        return 0;
    }

    function getScoreFromRow(row) {
        let rightDiv = row.querySelector('.layout-row-right .layout-vertical-up');
        if (rightDiv) return parseScore(rightDiv.textContent);
        return null;
    }

    function getDetailsFromRow(row) {
        let detailsDiv = row.querySelector('.layout-row-middle .layout-vertical-down');
        if (detailsDiv) return detailsDiv.textContent.trim();
        return '';
    }

    function parseTeacherInfo(rawTeacher) {
        if (!rawTeacher) return '（无教师信息）';
        let parts = rawTeacher.split(',');
        let first = parts[0];
        let match = /^[^-]+-([^$]+)\$([^$]*)\$([^$]*)$/.exec(first);
        if (match) {
            let name = match[1];
            let org = match[2];
            let suffix = parts.length > 1 ? `等${parts.length}人` : '';
            return `${name}（${org}）${suffix}`;
        }
        return first + (parts.length > 1 ? ` 等${parts.length}人` : '');
    }

    function getTeacherFromExtras(row) {
        let extraDiv = row.querySelector('.layout-vertical-extra');
        if (!extraDiv) return null;
        let ps = extraDiv.querySelectorAll('p');
        for (let p of ps) {
            let b = p.querySelector('b');
            if (b && b.textContent.includes('教师信息')) {
                let span = p.querySelector('span');
                if (span) return span.textContent.trim();
            }
        }
        return null;
    }

    function getCourseTypeFromRow(row) {
        let detailsDiv = row.querySelector('.layout-row-middle .layout-vertical-down');
        if (!detailsDiv) return '';
        let t = detailsDiv.textContent.trim();
        let i = t.indexOf(' - ');
        return i === -1 ? t : t.slice(0, i);
    }

    function getCourseNameFromRow(row) {
        let nameDiv = row.querySelector('.layout-row-middle .layout-vertical-up');
        if (nameDiv) return nameDiv.textContent.trim();
        return '';
    }

    function calcWeightedGPA(courseData) {
        let totalCredit = 0, totalWeighted = 0;
        courseData.forEach(c => {
            let gpa = scoreToGPA(c.score);
            if (gpa !== null && c.credit > 0) {
                totalCredit += c.credit;
                totalWeighted += c.credit * gpa;
            }
        });
        return totalCredit > 0 ? totalWeighted / totalCredit : null;
    }

    function sortCourses(courseData) {
        return courseData.slice().sort((a, b) => {
            let gpaA = scoreToGPA(a.score);
            let gpaB = scoreToGPA(b.score);
            if (gpaA !== gpaB) {
                if (gpaB === null) return -1;
                if (gpaA === null) return 1;
                return gpaB - gpaA;
            }
            let failA = isFail(a.score) ? 1 : 0;
            let failB = isFail(b.score) ? 1 : 0;
            if (failA !== failB) return failA - failB;
            return b.origIndex - a.origIndex;
        });
    }

    let rainbowStyleInjected = false;
    function ensureRainbowKeyframes() {
        if (rainbowStyleInjected) return;
        let style = document.createElement('style');
        style.textContent = `
            @keyframes gm-rainbow {
                from { background-position: 0 0; }
                to { background-position: -1000px 0; }
            }
        `;
        document.head.appendChild(style);
        rainbowStyleInjected = true;
    }

    function applyCourseColor(el, score) {
        if (score === null) return;
        if (typeof score === 'number' && score > 99.995) {
            ensureRainbowKeyframes();
            el.classList.add('rainbow-moving');
            el.style.removeProperty('background');
            el.style.animation = 'gm-rainbow 5s linear infinite';
        } else {
            el.classList.remove('rainbow-moving');
            el.style.removeProperty('animation');
            let g = getGradient(score, useGPAMode);
            el.style.background = g.bg;
        }
    }

    function isOverallBlock(block) {
        let titleUp = block.querySelector('.layout-row-middle .layout-vertical-up');
        if (!titleUp) return false;
        let text = titleUp.textContent.trim();
        return text === '总绩点' || text === '总学分';
    }

    function processSemesterBlock(block) {
        if (block.dataset.gmProcessed) return;

        let titleRow = block.querySelector(':scope > div:first-child .layout-row');
        let courseRowEls = Array.from(block.querySelectorAll('.course-row'));
        if (!titleRow) return;
        if (courseRowEls.length === 0) {
            if (isOverallBlock(block)) {
                processOverallBlock(block);
            }
            return;
        }

        courseRowEls.forEach(el => {
            if (!el.dataset.gmOrder) el.dataset.gmOrder = gmOrderCounter++;
        });

        let courseData = courseRowEls.map((el, index) => {
            let row = el.querySelector('.layout-row');
            return {
                el: el,
                row: row,
                credit: getCreditFromRow(row),
                score: getScoreFromRow(row),
                details: getDetailsFromRow(row),
                origIndex: index
            };
        });

        let sorted = sortCourses(courseData);
        let container = courseRowEls[0].parentElement;
        sorted.forEach(c => container.appendChild(c.el));

        sorted.forEach(c => {
            applyCourseColor(c.row, c.score);

            let rightDiv = c.row.querySelector('.layout-row-right .layout-vertical');
            if (rightDiv) {
                let upDiv = rightDiv.querySelector('.layout-vertical-up');
                let downDiv = rightDiv.querySelector('.layout-vertical-down');
                if (!downDiv) {
                    downDiv = document.createElement('div');
                    downDiv.className = 'layout-vertical-down';
                    if (upDiv) {
                        Array.from(upDiv.attributes).forEach(attr => {
                            if (attr.name.startsWith('data-v-')) downDiv.setAttribute(attr.name, attr.value);
                        });
                    }
                    rightDiv.appendChild(downDiv);
                }
                if (upDiv) upDiv.textContent = getScoreDisplay(c.score);
                downDiv.textContent = getGPADisplay(c.score);
            }

            let detailsDiv = c.row.querySelector('.layout-row-middle .layout-vertical-down');
            if (detailsDiv && !detailsDiv.dataset.gmSet) {
                let courseType = c.details;
                let rawTeacher = getTeacherFromExtras(c.row);
                let teacherStr = parseTeacherInfo(rawTeacher);
                detailsDiv.textContent = courseType + ' - ' + teacherStr;
                detailsDiv.dataset.gmSet = '1';
            }
        });

        let avgGPA = calcWeightedGPA(courseData);
        let avg100 = gpaTo100(avgGPA);
        titleRow.style.backgroundColor = getTitleColor(avg100, useGPAMode);
        let titleMiddle = titleRow.querySelector('.layout-row-middle');
        if (titleMiddle) titleMiddle.style.padding = '0';

        if (!titleRow.querySelector('.gm-credit-cell')) {
            let totalCredit = 0;
            courseData.forEach(c => {
                if (!isCreditExcluded(c.score)) totalCredit += c.credit;
            });
            let creditCell = document.createElement('div');
            creditCell.className = 'layout-row-left gm-credit-cell';
            creditCell.innerHTML = `
                <div class="layout-vertical">
                    <div class="layout-vertical-up">${totalCredit}</div>
                    <div class="layout-vertical-down">学分</div>
                </div>
            `;
            titleRow.insertBefore(creditCell, titleRow.firstChild);
        }

        let titleMiddleDiv = titleRow.querySelector('.layout-row-middle .layout-vertical');
        if (titleMiddleDiv) {
            let downDiv = titleMiddleDiv.querySelector('.layout-vertical-down');
            if (downDiv && !downDiv.dataset.gmSet) {
                downDiv.textContent = `共 ${courseData.length} 门课程`;
                downDiv.dataset.gmSet = '1';
            }
        }

        let titleRightDiv = titleRow.querySelector('.layout-row-right .layout-vertical');
        if (titleRightDiv) {
            let upDiv = titleRightDiv.querySelector('.layout-vertical-up');
            let downDiv = titleRightDiv.querySelector('.layout-vertical-down');
            if (!upDiv) {
                upDiv = document.createElement('div');
                upDiv.className = 'layout-vertical-up';
                if (downDiv) {
                    Array.from(downDiv.attributes).forEach(attr => {
                        if (attr.name.startsWith('data-v-')) upDiv.setAttribute(attr.name, attr.value);
                    });
                }
                titleRightDiv.insertBefore(upDiv, titleRightDiv.firstChild);
            }
            if (!downDiv) {
                downDiv = document.createElement('div');
                downDiv.className = 'layout-vertical-down';
                if (upDiv) {
                    Array.from(upDiv.attributes).forEach(attr => {
                        if (attr.name.startsWith('data-v-')) downDiv.setAttribute(attr.name, attr.value);
                    });
                }
                titleRightDiv.appendChild(downDiv);
            }
            let displayGPA = upDiv.textContent.trim();
            if (displayGPA === '-.--' || !displayGPA) {
                displayGPA = avgGPA !== null ? avgGPA.toFixed(2) : '-.--';
            }
            upDiv.textContent = displayGPA;
            downDiv.textContent = avg100 !== null ? formatNumber(avg100, 1) : '-.--';
        }

        block.dataset.gmProcessed = '1';
    }

    function getBlockTitle(block) {
        let up = block.querySelector(':scope > div:first-child .layout-row-middle .layout-vertical-up');
        return up ? up.textContent.trim() : '';
    }

    function getBlockRightUp(block) {
        let up = block.querySelector(':scope > div:first-child .layout-row-right .layout-vertical-up');
        return up ? up.textContent.trim() : '';
    }

    function normalizeGPA(text) {
        if (!text) return '';
        text = text.trim();
        if (text === '-.--') return text;
        return /^\d+(\.\d+)?$/.test(text) ? text : '';
    }

    function buildVertical(upText, downText, dv) {
        let v = applyDataVAttrs(document.createElement('div'), dv);
        v.className = 'layout-vertical';
        let upDiv = applyDataVAttrs(document.createElement('div'), dv);
        upDiv.className = 'layout-vertical-up';
        upDiv.textContent = upText;
        let downDiv = applyDataVAttrs(document.createElement('div'), dv);
        downDiv.className = 'layout-vertical-down';
        downDiv.textContent = downText;
        v.appendChild(upDiv);
        v.appendChild(downDiv);
        return v;
    }

    function processOverallBlock(block, officialGPA) {
        if (block.dataset.gmProcessed) return;

        let titleRow = block.querySelector(':scope > div:first-child .layout-row');
        if (!titleRow) return;

        let dv = getDataVAttrs(titleRow.querySelector('.layout-vertical-up') || titleRow);

        let courses = [];
        document.querySelectorAll('.semester-block').forEach(sb => {
            if (sb === block) return;
            if (getBlockTitle(sb).includes('总')) return;
            sb.querySelectorAll('.course-row').forEach(el => {
                if (!el.dataset.gmOrder) el.dataset.gmOrder = gmOrderCounter++;
                let row = el.querySelector('.layout-row');
                if (!row) return;
                courses.push({
                    order: parseInt(el.dataset.gmOrder, 10) || 0,
                    credit: getCreditFromRow(row),
                    score: getScoreFromRow(row),
                    type: getCourseTypeFromRow(row),
                    name: getCourseNameFromRow(row)
                });
            });
        });
        courses.sort((a, b) => a.order - b.order);

        let totalCredit = 0;
        courses.forEach(c => {
            if (!isCreditExcluded(c.score)) totalCredit += c.credit;
        });

        let overallGPA = calcWeightedGPA(courses);
        let overall100 = gpaTo100Display(overallGPA);
        let overall100Color = typeof overall100 === 'number' ? overall100 : null;
        let overall100Text = typeof overall100 === 'number' ? formatNumber(overall100, 1) : overall100;

        let gpaText = (officialGPA && officialGPA.trim()) || (overallGPA !== null ? overallGPA.toFixed(2) : '-.--');
        if (!gpaText) gpaText = '-.--';

        titleRow.style.backgroundColor = getTitleColor(overall100Color, useGPAMode);
        titleRow.innerHTML = '';

        let left = applyDataVAttrs(document.createElement('div'), dv);
        left.className = 'layout-row-left';
        left.appendChild(buildVertical(formatNumber(totalCredit, 1), '学分', dv));

        let middle = applyDataVAttrs(document.createElement('div'), dv);
        middle.className = 'layout-row-middle';
        middle.appendChild(buildVertical('总绩点', `共 ${courses.length} 门课程，官方 GPA：${gpaText}`, dv));

        let right = applyDataVAttrs(document.createElement('div'), dv);
        right.className = 'layout-row-right';
        right.appendChild(buildVertical(gpaText, overall100Text, dv));

        titleRow.appendChild(left);
        titleRow.appendChild(middle);
        titleRow.appendChild(right);

        while (block.children.length > 1) block.removeChild(block.lastElementChild);

        let byType = new Map();
        courses.forEach(c => {
            let k = c.type || '';
            let a = byType.get(k);
            if (!a) byType.set(k, a = []);
            a.push(c);
        });

        let overallRows = [];
        byType.forEach((arr, title) => {
            let gpaSum = 0, scoreSum = 0, n = 0, creditSum = 0;
            let data = [];
            arr.forEach(c => {
                if (!isCreditExcluded(c.score)) creditSum += c.credit;
                data.push({ left: `${formatNumber(c.credit, 1)}学分`, right: `${c.name} - ${getScoreDisplay(c.score)}` });
                if (typeof c.score === 'number') {
                    n++;
                    scoreSum += c.score;
                    let g = scoreToGPA(c.score);
                    gpaSum += g === null ? 0 : g;
                }
            });
            overallRows.push({
                title: title,
                title_xf: formatNumber(creditSum, 1),
                class: `共 ${n} 门课程`,
                xf: formatNumber(gpaSum / n, 2),
                score: formatNumber(scoreSum / n, 2),
                scoreValue: scoreSum / n,
                data: data
            });
        });
        overallRows.sort((a, b) => parseFloat(b.score) > parseFloat(a.score) ? 1 : -1);

        overallRows.forEach(r => {
            let wrap = applyDataVAttrs(document.createElement('div'), dv);
            let row = applyDataVAttrs(document.createElement('div'), dv);
            row.className = 'layout-row course-row';
            if (typeof r.scoreValue === 'number' && !isNaN(r.scoreValue)) {
                row.dataset.gmScore = String(r.scoreValue);
                applyCourseColor(row, r.scoreValue);
            }

            let extra = applyDataVAttrs(document.createElement('div'), dv);
            extra.className = 'layout-vertical-extra layout-vertical-extra-show';
            extra.style.display = 'none';
            let extraInner = applyDataVAttrs(document.createElement('div'), dv);
            r.data.forEach(d => {
                let p = applyDataVAttrs(document.createElement('p'), dv);
                let b = applyDataVAttrs(document.createElement('b'), dv);
                b.textContent = d.left + ' - ';
                p.appendChild(b);
                p.appendChild(document.createTextNode(d.right));
                extraInner.appendChild(p);
            });
            extra.appendChild(extraInner);

            row.onclick = function() {
                extra.style.display = extra.style.display === 'none' ? '' : 'none';
            };

            let l = applyDataVAttrs(document.createElement('div'), dv);
            l.className = 'layout-row-left';
            l.appendChild(buildVertical(r.title_xf, '学分', dv));

            let m = applyDataVAttrs(document.createElement('div'), dv);
            m.className = 'layout-row-middle';
            let mv = applyDataVAttrs(document.createElement('div'), dv);
            mv.className = 'layout-vertical';
            let mu = applyDataVAttrs(document.createElement('div'), dv);
            mu.className = 'layout-vertical-up';
            let span = applyDataVAttrs(document.createElement('span'), dv);
            let badge = applyDataVAttrs(document.createElement('span'), dv);
            badge.className = 'prevent-click-handler course-badge course-badge-primary';
            let icon = applyDataVAttrs(document.createElement('span'), dv);
            icon.className = 'icon icon-share';
            badge.appendChild(icon);
            span.appendChild(badge);
            span.appendChild(document.createTextNode(r.title));
            mu.appendChild(span);
            let md = applyDataVAttrs(document.createElement('div'), dv);
            md.className = 'layout-vertical-down';
            md.textContent = r.class;
            mv.appendChild(mu);
            mv.appendChild(md);
            mv.appendChild(extra);
            m.appendChild(mv);

            let rr = applyDataVAttrs(document.createElement('div'), dv);
            rr.className = 'layout-row-right';
            rr.appendChild(buildVertical(r.xf, r.score, dv));

            row.appendChild(l);
            row.appendChild(m);
            row.appendChild(rr);

            wrap.appendChild(row);
            block.appendChild(wrap);
        });

        block.dataset.gmOverall = '1';
        if (overall100Color !== null) block.dataset.gmOverallScore = String(overall100Color);

        block.dataset.gmProcessed = '1';
    }

    function processPage() {
        let semesterBlocks = Array.from(document.querySelectorAll('.semester-block'));
        if (semesterBlocks.length === 0) return;

        let gpaBlock = null, creditBlock = null;
        semesterBlocks.forEach(b => {
            let t = getBlockTitle(b);
            if (t.includes('总绩点')) gpaBlock = b;
            else if (t.includes('总学分')) creditBlock = b;
        });
        let target = creditBlock || gpaBlock;
        let officialGPA = gpaBlock ? normalizeGPA(getBlockRightUp(gpaBlock)) : null;

        semesterBlocks.forEach(block => {
            if (block === target) return processOverallBlock(block, officialGPA);
            if (block === gpaBlock && creditBlock) {
                if (!block.dataset.gmHidden) {
                    block.style.display = 'none';
                    block.dataset.gmHidden = '1';
                }
                return;
            }
            if (getBlockTitle(block).includes('总')) return;
            processSemesterBlock(block);
        });
    }

    function updateColors() {
        document.querySelectorAll('.semester-block').forEach(block => {
            if (block.dataset.gmHidden) return;
            let titleRow = block.querySelector(':scope > div:first-child .layout-row');
            if (!titleRow) return;
            if (block.dataset.gmOverall === '1') {
                let s = parseFloat(block.dataset.gmOverallScore || '');
                titleRow.style.backgroundColor = getTitleColor(isNaN(s) ? null : s, useGPAMode);
                block.querySelectorAll('.layout-row.course-row').forEach(row => {
                    let v = parseFloat(row.dataset.gmScore || '');
                    if (!isNaN(v)) applyCourseColor(row, v);
                });
                return;
            }
            if (getBlockTitle(block).includes('总')) return;
            let courseData = [];
            block.querySelectorAll('.course-row .layout-row').forEach(row => {
                let score = getScoreFromRow(row);
                applyCourseColor(row, score);
                courseData.push({ credit: getCreditFromRow(row), score: score });
            });
            let avgGPA = calcWeightedGPA(courseData);
            let avg100 = gpaTo100(avgGPA);
            titleRow.style.backgroundColor = getTitleColor(avg100, useGPAMode);
        });
    }

    function addColorToggle() {
        let controllerBar = document.querySelector('.controller-bar');
        if (!controllerBar || document.getElementById('gm-color-toggle')) return;

        let toggle = document.createElement('a');
        toggle.id = 'gm-color-toggle';
        toggle.innerHTML = '<span class="icon icon-display"></span> 四分制着色';
        toggle.title = '当前百分制着色，分数从60至100由红变绿';
        toggle.onclick = function() {
            useGPAMode = !useGPAMode;
            if (useGPAMode) {
                toggle.innerHTML = '<span class="icon icon-display"></span> 百分制着色';
                toggle.title = '当前四分制着色，GPA从1至4由红变绿';
            } else {
                toggle.innerHTML = '<span class="icon icon-display"></span> 四分制着色';
                toggle.title = '当前百分制着色，分数从60至100由红变绿';
            }
            updateColors();
        };
        controllerBar.appendChild(toggle);
    }

    function restoreFooter() {
        let container = document.querySelector('.container');
        if (!container) return;

        let footer = container.querySelector('.footer');
        if (footer && footer.classList.contains('gm-restored')) return;

        if (!footer) {
            footer = document.createElement('div');
            footer.className = 'footer';
            container.appendChild(footer);
        }

        footer.innerHTML = `
            <p>绩点公式 <a>GPA(x) = 4-3*(100-x)<sup>2</sup>/1600</a></p>
            <br>
            <p>学期GPA和总GPA为公式计算所得，请以学校官方结果为准！</p>
        `;
        footer.classList.add('gm-restored');
    }

    function init() {
        let viewer = document.querySelector('.viewer');
        if (viewer) {
            processPage();
            addColorToggle();
            restoreFooter();
        }
    }

    let observer = new MutationObserver(function(mutations) {
        let shouldProcess = mutations.some(m => {
            if (m.type === 'childList' && m.addedNodes.length > 0) {
                for (let node of m.addedNodes) {
                    if (node.nodeType === 1) {
                        if (node.classList && (
                            node.classList.contains('viewer') ||
                            node.classList.contains('semester-block') ||
                            node.classList.contains('course-row')
                        )) return true;
                        if (node.querySelector && (
                            node.querySelector('.viewer') ||
                            node.querySelector('.semester-block')
                        )) return true;
                    }
                }
            }
            return false;
        });
        if (shouldProcess) setTimeout(init, 100);
    });

    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    } else {
        document.addEventListener('DOMContentLoaded', function() {
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    setInterval(function() {
        if (document.querySelector('.viewer') && !document.getElementById('gm-color-toggle')) init();
    }, 1000);

    function forceBackground() {
        let main = document.querySelector('.main');
        if (main) main.style.setProperty('background-color', '#333', 'important');
    }

    if (document.body) forceBackground();
    document.addEventListener('DOMContentLoaded', forceBackground);
    window.addEventListener('load', forceBackground);
    setInterval(forceBackground, 500);

})();
