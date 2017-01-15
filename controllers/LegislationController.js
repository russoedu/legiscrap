const Legislation = require('../models/Legislation.js');
const debug = require('debug')('api');
const error = require('../helpers/error');
const log = require('../helpers/log');

const pvt = {
  readData(req) {
    debug(req);
    let hasSlug = false;
    const base = '_parsedUrl';
    const path = req[base].pathname;
    const data = path.split('/');

    let parent = '';
    let slug = /./;

    data.forEach((value, key) => {
      if (value === 'l') {
        slug = data[key + 1];
        hasSlug = true;
      } else if (!hasSlug && value !== '') {
        parent += `/${value}`;
      }
    });

    if (parent === '') {
      parent = '/';
    }

    const response = {
      search: {
        parent,
      },
      hasSlug,
    };

    if (hasSlug) {
      response.search.slug = slug;
    }

    debug(response);
    return response;
  },

  allIndexOf(text, searchRegEx) {
    debug(searchRegEx);
    const indices = [];
    let exec = true;
    while (exec) {
      const result = searchRegEx.exec(text);
      if (result !== null) {
        indices.push(result.index);
        debug(result.index, exec);
      } else {
        exec = false;
        debug(result, exec);
      }
    }
    // for (let pos = text.indexOf(search); pos !== -1; pos = text.indexOf(search, pos + 1)) {
    //   indices.push(pos);
    // }
    return indices;
  },

  setSearchMarks(data, search) {
    const response = data;
    response.marks = [];

    response.content = response.content
                          .replace(/[\n\t\r]+/img, ' ')
                          .replace(/(&nbsp;)+/img, ' ');

    const searchRegEx = new RegExp(`(${search})`, 'img');
    const indices = pvt.allIndexOf(response.content, searchRegEx);
    debug(indices);

    const delta = 30;
    const wordLength = search.length;

    indices.forEach((index) => {
      let begin = 0;
      let end = response.content.length;

      if (index >= begin + delta) {
        begin = index - delta;
      }
      if (index <= end - wordLength - delta) {
        end = index + wordLength + delta;
      }
      let res = response.content.substring(begin, end);
      res = res
            .replace(/>|(<?\/?[A-z]+>)|(<\/?[A-z]+>?)|</img, '')
            .replace(searchRegEx, `<mark id="mark-${index}">$1</mark>`);

      res = `…${res}…`;
      response.marks.push(res);
    });

    debug(response.marks);
  },
};

class LegislationController {
  static list(req, res) {
    debug('LegislationController.find()');

    const readData = pvt.readData(req);
    const search = readData.search;
    const hasSlug = readData.hasSlug;

    const searchQuery = typeof req.query.search === 'undefined' ?
                        false :
                        decodeURIComponent(req.query.search);

    if (searchQuery) {
      search.parent = new RegExp(`${search.parent}.*`, 'img');
      search.type = 'LEGISLATION';
      search.content = new RegExp(`.*${searchQuery}.*`, 'img');
    }

    let resultData = {};

    // Don't send the content string if it's not a legislation (!hasSlug) or search (!searchQuery)
    if (!hasSlug && !searchQuery) {
      resultData = {
        _id: '',
        name: '',
        url: '',
        type: '',
        slug: '',
        parent: '',
      };
    }
    log(search);
    log(searchQuery);

    Legislation.list(search, resultData)
      .then((listResponse) => {
        const response = listResponse;
        if (searchQuery) {
          response.forEach((data) => {
            debug(data.name, data._id);
            pvt.setSearchMarks(data, searchQuery);
            delete data.content;
          });
        }
        res.status(200).send(response);
      })
      .catch((err) => {
        error(req.params.name, 'Could not retrieve data', err);
        res.status(400).json(err);
      });
  }
}

module.exports = LegislationController;
