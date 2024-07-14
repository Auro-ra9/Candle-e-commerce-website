const userSchema = require('../../model/userSchema')
const productSchema = require('../../model/productSchema')
const cartSchema = require('../../model/cartSchema')


const viewCart = async (req, res) => {
    // Pagination parameters
    const cartPerPage = 8
    const currentPage = parseInt(req.query.page) || 1
    const skip = (currentPage - 1) * cartPerPage

    try {
        const productInCart = await cartSchema.findOne({ userID: req.session.user }).populate('items.productID').sort({'items.createdAt':-1})

        if (productInCart) {
            productInCart.items.sort((productA, productB) => productB.createdAt - productA.createdAt)

            // Calculate total number of items and pages
            const totalItems = productInCart.items.length
            const totalPages = Math.ceil(totalItems / cartPerPage)

            let subTotal = 0
            let total = 0
            let totalDiscount = 0

            productInCart.items.forEach((product) => {
                subTotal += product.productCount * (product.productID.productPrice)
                total += (product.productID.productPrice * (1 - product.productID.discount / 100) * (product.productCount))
            })
            totalDiscount = subTotal - total

            res.render('user/cart', {
                title: 'cart',
                alertMessage: req.flash('errorMessage'),
                productInCart,
                subTotal,
                total,
                totalDiscount,
                currentPage,
                totalPages,
                query: req.query
            })
        } else {
            res.render('user/cart', {
                title: 'cart',
                alertMessage: req.flash('errorMessage'),
                productInCart: [],
                subTotal: 0,
                total: 0,
                totalDiscount: 0,
                currentPage,
                totalPages: 1,
                query: req.query
            })
        }

    } catch (err) {
        console.log(`error on cart ${err}`)
    }
}

const addToCart = async (req, res) => {
    try {
        const productID = req.params.productID
        console.log(productID);
        if (!productID) {
            return res.status(404).json({ message: 'product could not find' })
        }

        const productDetails = await productSchema.findById(productID)

        if (!productDetails) {
            return res.status(404).json({ message: 'product could not find' })
        }
        if (productDetails.productQuantity === 0) {
            return res.status(404).json({ message: 'Product is out of stock' });
        }

        //checking whether the user already have the cart, if it yes then adding to the existing or creating new

        const cart = await cartSchema.findOne({ userID: req.session.user }).populate('items.productID')

        if (!cart) {
            const newCart = new cartSchema({
                userID: req.session.user,
                items: [{
                    productID: productDetails._id,
                    productCount: 1

                }]
            })
            await newCart.save()
        } else {
            // check product is therre in cart
            let productInCart = false

            for (const checkProduct of cart.items) {
                if (checkProduct.productID.id === productID) {
                    productInCart = true
                    if(checkProduct.productCount<10){
                        checkProduct.productCount++
                    }else{

                        return res.status(404).json({ existInCart: 'product limit reached in cart' })
                    }
                }
            }

            if (!productInCart) {
                cart.items.push({
                    productID: productDetails._id,
                    productCount: 1
                })

            }
            await cart.save()
        }

        return res.status(200).json({ success: "Product addded to cart" })

    } catch (err) {
        console.log(`error on adding to cart post${err}`)
    }
}


//delete cart
const deleteFromCart = async (req, res) => {
    try {
        const productID = req.params.productID
        const userID = req.session.user
        const cart = await cartSchema.findOne({ userID: userID }).populate('items.productID')

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' })
        }

        const newProductList = cart.items.filter((cartProduct) => {
            if (cartProduct.productID.id != productID) {
                return cartProduct
            }
        })

        cart.items = newProductList

        await cart.save()


        return res.status(200).json({ success: "Product removed from cart" })
    } catch (err) {
        console.log(`error on deleting from cart ${err}`)
        return res.status(500).json({ message: 'Failed to remove product from cart' })
    }
}

//increase the quantity in the cart

const increaseQuantity = async (req, res) => {
    try {
        const productID = req.params.productID
        const userID = req.session.user
        const cart = await cartSchema.findOne({ userID: userID }).populate('items.productID')

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' })
        }

        let productTotal = 0
        let productCount = 0
        for (const checkProduct of cart.items) {
            if (checkProduct.productID.id === productID) {
                if (checkProduct.productCount >= 10) {
                    return res.status(404).json({ limitReached: "product limit reached" })
                }
                if (checkProduct.productID.productQuantity < checkProduct.productCount + 1) {
                    return res.status(404).json({ stockReached: `only ${checkProduct.productID.productQuantity} left` })
                }
                checkProduct.productCount++
                productTotal = checkProduct.productCount * (checkProduct.productID.productPrice * (1 - checkProduct.productID.discount / 100))
                productCount = checkProduct.productCount
                await cart.save()
            }
        }

        //changing and showing the total amounts and discounts in the frontend
        let totalAmount = 0
        let totalWithoutDiscount = 0
        let totalDiscount = 0

        cart.items.forEach((product) => {
            totalAmount += product.productCount * (product.productID.productPrice * (1 - product.productID.discount / 100))
            totalWithoutDiscount += product.productCount * (product.productID.productPrice)
        })
        totalDiscount = totalWithoutDiscount - totalAmount


        return res.status(200).json({
            success: 'Product quantity increased',
            productCount,
            productTotal,
            totalAmount,
            totalWithoutDiscount,
            totalDiscount
        })
    } catch (err) {
        console.log(`error on increasing quantity post ${err}`)
        return res.status(500).json({ message: 'Internal server error' })

    }
}

//decrease the quantity in cart

const decreaseQuantity = async (req, res) => {
    try {
        const productID = req.params.productID
        const userID = req.session.user
        const cart = await cartSchema.findOne({ userID: userID }).populate('items.productID')

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' })
        }

        let productTotal = 0
        let productCount = 0
        for (const checkProduct of cart.items) {
            if (checkProduct.productID.id === productID) {
                if (checkProduct.productCount <= 1) {
                    return res.status(400).json({ limitReached: "product count must have at least one" })
                }
                checkProduct.productCount--
                productTotal = checkProduct.productCount * (checkProduct.productID.productPrice * (1 - checkProduct.productID.discount / 100))
                productCount = checkProduct.productCount
                await cart.save()
            }
        }

        //changing and showing the total amounts and discounts in the frontend
        let totalAmount = 0
        let totalWithoutDiscount = 0
        let totalDiscount = 0

        cart.items.forEach((product) => {
            totalAmount += product.productCount * (product.productID.productPrice * (1 - product.productID.discount / 100))
            totalWithoutDiscount += product.productCount * (product.productID.productPrice)
        })
        totalDiscount = totalWithoutDiscount - totalAmount
        return res.status(200).json({
            success: 'Product quantity decreased',
            productCount,
            productTotal,
            totalAmount,
            totalWithoutDiscount,
            totalDiscount
        })
    } catch (err) {
        console.log(`error on decreasing quantity post ${err}`)
        return res.status(500).json({ message: 'Internal server error' })

    }
}

const validateCheckout=async(req,res)=>{
    try {
        const cart=await cartSchema.findOne({userID:req.session.user}).populate('items.productID')

        for(const item of cart.items){
            if(item.productCount>item.productID.productQuantity){
                return res.status(404).json({error:"Product count unavailable",product:item.productID.productName})
            }
        }

        let subTotal = 0
        let total = 0

        cart.items.forEach((product) => {
            subTotal += product.productCount * (product.productID.productPrice)
            total += (product.productID.productPrice * (1 - product.productID.discount / 100) * (product.productCount))
        })

        cart.payableAmount=total
        cart.totalPrice=subTotal

        if(cart.payableAmount<500){
            cart.payableAmount+=50
        }

        cart.couponID="";
        cart.couponDiscount=0
        await cart.save()
       

        return res.status(200).json({message:"Proceed to checkout"})
        
    } catch (err) {
        console.log("Error on checkout valiidation ",err);
    }
}

module.exports = {
    viewCart,
    addToCart,
    deleteFromCart,
    increaseQuantity,
    decreaseQuantity,
    validateCheckout

}