const path = require('path');


function resolveAlias(id, basedir, importOptions) {
  const { root } = importOptions;

  // resolve @Styles alias
  if (/^@Styles/.test(id)) {
    const [ assetType, filename ] = id.split('/');
    return `${root}/assets/styles/${filename}`;
  }

  // resolve relative path, @import './components/style.css'; prefix with './' or '../'
  // if (/^\./.test(id)) return path.resolve(basedir, id);

  // resolve node_modules, @import 'normalize.css/normalize.css'
  // return path.resolve('./node_modules', id);
}


module.exports = {
  plugins: [
    ['postcss-import', {
      root: 'src',
      path: ['app', 'assets', 'components'],
      skipDuplicates: true,
      resolve: resolveAlias

    }],
    'postcss-nesting',
    'postcss-custom-media',
    'postcss-media-minmax',
    'autoprefixer'
  ]
};
