// 磁力 新6V
import req from '../../util/req.js';
import { load } from 'cheerio';
import { ua, init as _init ,detail as _detail ,proxy ,play } from '../../util/pan.js';
import {firstSuccessfulUrl} from "../../util/utils.js";

const siteUrl = "https://www.xb6v.com";

const header = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': siteUrl
};

function getActorOrDirector(str) {
    return str.replace(/<br>/g, "")
        .replace(/&nbsp;./g, "")
        .replace(/&amp;/g, "")
        .replace(/middot;/g, "・")
        .replace(/　　　　　/g, ",")
        .replace(/　　　　 　/g, ",")
        .replace(/　/g, "");
}

function getDescription(str) {
    return str.replace(/<\/?[^>]+>/g, "")
        .replace(/\n/g, "")
        .replace(/&amp;/g, "")
        .replace(/middot;/g, "・")
        .replace(/ldquo;/g, "【")
        .replace(/rdquo;/g, "】")
        .replace(/　/g, "");
}

async function parseVodShortList(html) {
    const $ = load(html);
    return $("#post_container .post_hover").map((i, item) => ({
        vod_id: $(item).find("[class=zoom]").attr("href"),
        vod_name: $(item).find("[class=zoom]").attr("title"),
        vod_pic: $(item).find("img").attr("src"),
        vod_remarks: $(item).find("[rel='category tag']").text().replace(/\s+/g, "")
    })).get();
}

async function parseVodDetail(html) {
    const $ = load(html);
    const vodDetail = {
        vod_name: $(".article_container > h1").text(),
        vod_pic: $("#post_content img").attr("src"),
        vod_play_from: [],
        vod_play_url: []
    };

    // 解析播放源
    $("#post_content").find("h2").each((i, elem) => {
        const sourceName = $(elem).text().trim();
        const playUrl = parsePlayUrl(sourceName, $(elem).next().html());
        if (playUrl) {
            vodDetail.vod_play_from.push(sourceName);
            vodDetail.vod_play_url.push(playUrl);
        }
    });

    // 解析其他元数据
    const content = $("#post_content").text();
    vodDetail.vod_year = _.get(/年代<\/span>：(.*?)\s/.exec(content), 1);
    vodDetail.vod_area = _.get(/地区<\/span>：(.*?)\s/.exec(content), 1);
    vodDetail.vod_actor = getActorOrDirector(_.get(/主演<\/span>：(.*?)\s/.exec(content), 1) || "");
    vodDetail.vod_director = getActorOrDirector(_.get(/导演<\/span>：(.*?)\s/.exec(content), 1) || "");
    vodDetail.vod_content = getDescription(content);

    return {
        ...vodDetail,
        vod_play_from: vodDetail.vod_play_from.join("$$$"),
        vod_play_url: vodDetail.vod_play_url.join("$$$")
    };
}

function parsePlayUrl(sourceName, html) {
    const $ = load(html);
    switch (sourceName) {
        case "播放地址（无插件 极速播放）":
        case "播放地址三":
            return $("iframe").attr("src") + "/index.m3u8";
        case "播放地址（无需安装插件）":
            return _.get(/url: '(.*?)'/.exec(html), 1);
        case "播放地址四":
            return _.get(/source: "(.*?)"/.exec(html), 1);
        default:
            return null;
    }
}

async function init(inReq) {
    return {};
}

async function home() {
    const html = await req.get(siteUrl, { headers: header });
    const $ = load(html);
    const classes = $("#menus > li > a").slice(2, -1).map((i, elem) => ({
        type_id: $(elem).attr("href"),
        type_name: $(elem).text()
    })).get();

    return {
        class: classes,
        filters: {}
    };
}

async function category(inReq) {
    const { id, page = 1, filters = {} } = inReq.body;
    const url = `${siteUrl}${id}${filters.cateId || ""}/page/${page}`;
    const html = await req.get(url, { headers: header });
    
    return {
        page: Number(page),
        pagecount: 99, // 网站无明确分页信息
        list: await parseVodShortList(html)
    };
}

async function detail(inReq) {
    const { id } = inReq.body;
    const html = await req.get(`${siteUrl}${id}`, { headers: header });
    
    return {
        list: [await parseVodDetail(html)]
    };
}

async function play(inReq) {
    const { id } = inReq.body;
    return {
        parse: 0,
        url: id.startsWith("magnet") ? id : await req.get(id, { headers: header })
    };
}

async function search(inReq) {
    const { wd } = inReq.body;
    const form = {
        show: "title",
        tempid: 1,
        tbname: "article",
        mid: 1,
        dopost: "search",
        keyboard: wd
    };
    
    const html = await req.post(`${siteUrl}/e/search/index.php`, {
        headers: { ...header, 'Content-Type': 'application/x-www-form-urlencoded' },
        data: form
    });

    return {
        list: await parseVodShortList(html)
    };
}

export default {
    meta: {
        key: 'xb6v',
        name: '磁力新6V',
        type: 3
    },
    api: async (fastify) => {
        fastify.post('/init', init);
        fastify.post('/home', home);
        fastify.post('/category', category);
        fastify.post('/detail', detail);
        fastify.post('/play', play);
        fastify.post('/search', search);
    }
};
