import sass from 'node-sass';
import path from 'path';
import Audit from './audit';

function toFilename(originFile) {
  return path.basename(originFile).replace(/(scss|sass)$/i, 'css');
}

function toAsset(buffer) {
  return {
    source: function() { return buffer; },
    size: function() { return buffer.byteLength; }
  };
}

function toError(err) {
  var header = '[sass-webpack-plugin]';
  if(err.file && err.line) {
    header = `${header} ${err.file}:${err.line}`;
  }
  return new Error(`${header}\n\n${err.message}\n`);
}

class SassPlugin {
  constructor(file, mode, custom) {
    var options = {};

    if(mode === 'development' || mode === undefined) {
      options = {
        indentedSyntax: true,
        indentWidth: 2,
        sourceMap: true,
        sourceMapEmbed: true,
        sourceComments: true,
        sourceMapContents: true
      };
    } else if(mode === 'production') {
      options = { outputStyle: 'compressed' };
    } else if(typeof mode === 'object') {
      options = mode;
    }

    if(typeof custom === 'object') {
      options = Object.assign(options, custom);
    }
    options.file = path.resolve(file);
    this.options = options;
  }

  apply(compiler) {
    let options = this.options;
    let rootDir = path.dirname(options.file);
    let audit = new Audit(path.join(compiler.context, 'node_modules'));

    compiler.plugin('emit', function(compilation, cb) {
      audit.calculateHash(compilation.fileTimestamps);

      if(audit.hash == null) return cb();

      sass.render(options, function(err, result) {
        if(err) {
          compilation.errors.push(toError(err));
        } else {
          audit.track(result.stats);
          compilation.assets[toFilename(options.file)] = toAsset(result.css);
        }
        cb();
      });
    });

    compiler.plugin('after-emit', function(compilation, cb) {
      // watch over structure inside style folder
      if(compilation.contextDependencies.indexOf(rootDir) === -1) {
        compilation.contextDependencies.push(rootDir);
      }

      if(audit.hash) {
        audit.getDependencies(compilation.fileDependencies).forEach(function(filepath) {
          compilation.fileDependencies.push(filepath);
        });

        if(audit.hash !== 'init') compilation.modifyHash(audit.hash);
      }

      cb();
    });
  }
}

export default SassPlugin;
