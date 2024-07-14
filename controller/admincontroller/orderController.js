const categorySchema = require('../../model/categorySchema');
const productSchema = require('../../model/productSchema');
const orderSchema = require('../../model/orderSchema');
const express = require('express');
const path = require("path");
const fs = require('fs');
const walletSchema = require('../../model/walletSchema');


const orderList = async (req, res) => {
    try {
        // Pagination parameters
        const ordersPerPage = 8
        const currentPage = parseInt(req.query.page) || 1
        const skip = (currentPage - 1) * ordersPerPage

        // Counting the total number of orders
        const ordersCount = await orderSchema.countDocuments()

        // Fetching the orders for the current page
        const orders = await orderSchema.find().sort({ createdAt: -1 }).skip(skip).limit(ordersPerPage)

        res.render('admin/listOrders', {
            title: 'orders',
            alertMessage: req.flash('errorMessage'),
            orders,
            currentPage,
            totalPages: Math.ceil(ordersCount / ordersPerPage)
        })
    } catch (err) {
        console.log(`Error on order list render: ${err}`)
    }
}

//rendering edit order page admin
const editOrder = async (req, res) => {
    try {
        const orderID = req.params.orderID
        const order = await orderSchema.findById(orderID).populate('products.productID').populate('address').sort({ createdAt: -1 })
        res.render('admin/editOrder', {
            title: 'Edit Order',
            alertMessage: req.flash('errorMessage'),
            order
        })
    } catch (err) {
        console.log(`Error on edit orders on admin: ${err}`)
    }
}

// editing order status
const editOrderPost = async (req, res) => {
    try {
        const orderID = req.params.orderID
        const newStatus = req.body.orderStatus
        const currentOrder = await orderSchema.findById(orderID)

        // Validate status change based on current status
        //current order if is confirmed then allowing only shipping otherwise no
        if (currentOrder.orderStatus === 'Confirmed' && newStatus !== 'Shipping') {
            req.flash('errorMessage', 'Cannot change order status from Confirmed except to Shipping')
            return res.redirect('/admin/edit-order')

            //current order if is shipping  then allowing only deleviring otherwise no
        } else if (currentOrder.orderStatus === 'Shipping' && newStatus !== 'Delivered') {
            req.flash('errorMessage', 'Order must be Delivered to change from Shipping')
            return res.redirect('/admin/edit-order')

        }
        // Update order status
        await orderSchema.findByIdAndUpdate(orderID, { orderStatus: newStatus })
        req.flash('errorMessage', 'Order status updated successfully')
        res.redirect('/admin/orders')

    } catch (err) {
        console.log(`Error on admin edit order post: ${err}`)
        req.flash('errorMessage', 'Failed to update order status')
        res.redirect('/admin/orders')
    }
}
// editing order status
const approveReturn = async (req, res) => {
    try {
        const orderID = req.params.orderID
        const currentOrder = await orderSchema.findById(orderID)

        console.log(currentOrder)

        if (!currentOrder) {
            return res.status(404).json({ message: 'could not find the order status' })
        }

        if (currentOrder.orderStatus === 'Pending-Returned') {
            const newStatus = 'Returned'

            // Update order status
            await orderSchema.findByIdAndUpdate(orderID, { orderStatus: newStatus })

            const wallet = await walletSchema.findOne({ userID: currentOrder.userID })

            if (wallet) {
                wallet.balance += currentOrder.totalPrice
                await wallet.save()
            } else {
                const newWallet = new walletSchema({
                    userID: currentOrder.userID,
                    balance: currentOrder.totalPrice,
                })
                await newWallet.save()
            }


            return res.status(200).json({ message: 'successfully updated the status' })

        }

    } catch (err) {
        console.log(`Error on admin approve return order post: ${err}`)
        return res.status(404).json({ message: 'error on approving the return request' })

    }
}

const rejectReturn = async (req, res) => {
    try {
        const orderID = req.params.orderID
        const currentOrder = await orderSchema.findById(orderID)

        if (!currentOrder) {
            return res.status(404).json({ message: 'Order not found' })
        }

        if (currentOrder.orderStatus !== 'Pending-Returned') {
            return res.status(400).json({ message: 'Cannot reject order that is not Pending-Returned' })
        }

        const newStatus = 'Delivered'
        const reason = req.body.rejectingReturn

        // Update order status and reason for rejection
        await orderSchema.findByIdAndUpdate(orderID, { orderStatus: newStatus, reasonForRejection: reason })
        return res.status(200).json({ message: 'Successfully updated the status' })
    } catch (err) {
        console.log(`Error on admin reject return order: ${err}`)

    }
}




module.exports = {
    orderList,
    editOrder,
    editOrderPost,
    approveReturn,
    rejectReturn,

}