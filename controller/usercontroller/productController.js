const productSchema = require("../../model/productSchema");
const mongoose = require('mongoose')

const viewProductRender = async (req, res) => {
  try {
    const productID = req.params.productID;

    // Validate productID
    if (!mongoose.Types.ObjectId.isValid(productID)) {
      req.flash('errorMessage', 'Invalid product ID');
      return res.redirect('/home');
    }


    // finding product details in db
    const productDetail = await productSchema.findById(productID).populate('category');

    // error message if product could not find
    if (!productDetail) {
      req.flash('errorMessage', 'Cannot find the product details');
      return res.redirect('/home');
    }

    // Pagination parameters
    const productsPerPage = 8;
    const currentPage = parseInt(req.query.page) || 1;
    const skip = (currentPage - 1) * productsPerPage;

    // Showing similar products, excluding the current product
    const similarProductsQuery = {
      category: productDetail.category,
      _id: { $ne: productID }, // Exclude the current product
    };

    //showing similar products
    const similarProducts = await productSchema.find(similarProductsQuery).sort({ createdAt: -1 })
      .skip(skip)
      .limit(productsPerPage);

    // Counting the total number of products matching the query
    const productsCount = await productSchema.countDocuments(similarProductsQuery);

    res.render('user/viewProduct', {
      title: 'product-view',
      alertMessage: req.flash('errorMessage'),
      user: req.session.user,
      productDetail,
      similarProducts,
      pageNumber: Math.ceil(productsCount / productsPerPage),
      currentPage,
      totalPages: Math.ceil(productsCount / productsPerPage),
      query: req.query
    });

  } catch (err) {
    console.log(`Error on View product render get ${err}`);
    req.flash('errorMessage', 'An error occurred while retrieving the product details');
    res.redirect('/home');
  }
};

module.exports = {
  viewProductRender,
};